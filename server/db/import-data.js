/**
 * Data Import Script for Detroit Memorial Park
 * Imports real data from Excel files into the database
 * 
 * Usage: node server/db/import-data.js
 */

import XLSX from 'xlsx';
import fs from 'fs';
import { query, pool } from './index.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Data file paths
const DATA_DIR = process.env.DATA_DIR || path.join(
  process.env.USERPROFILE || process.env.HOME,
  'OneDrive - Detroit Memorial Park Tenant'
);

const DATA_FILES = {
  burials: path.join(DATA_DIR, 'burials_All Departments_19250101_20260101.xlsx'),
  workOrders: path.join(DATA_DIR, 'work-orders-20251001to20260101.xlsx'),
  masterData: path.join(DATA_DIR, 'WORK', 'Data', 'Master_Data_Package.xlsx'),
  finalMaster: path.join(DATA_DIR, 'WORK', 'Data', 'final_master_cleaned 1.xlsx'),
  accountsReceivable: path.join(DATA_DIR, 'WORK', 'Data', 'ar_Dec. 21_saleitems.xlsx'),
  bankStatement: path.join(DATA_DIR, 'WORK', 'Data', '2023 BANKSTATMENT_DMPA_Comerica new.xlsx'),
  salesApp: path.join(DATA_DIR, 'Sales app.xlsx'),
  retailSales: path.join(DATA_DIR, 'retail_sales_west_2020.xlsx'),
  financialPackage: path.join(DATA_DIR, 'ULTIMATE_FINANCIAL_PACKAGE.xlsx'),
  vendorBills: path.join(DATA_DIR, 'Zoom2Day_VendorBills_ExpenseLines_2023-09_to_2024-08.csv'),
  benefitsFolder: path.join(DATA_DIR, 'benefits'),
};

// Helper to read Excel file
function readExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    console.log(`Reading: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheets = {};

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    }

    return { workbook, sheets, sheetNames: workbook.SheetNames };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

// Helper to read CSV file
function readCSV(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    console.log(`Reading CSV: ${filePath}`);
    const workbook = XLSX.readFile(filePath, { type: 'binary' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    return rows;
  } catch (error) {
    console.error(`Error reading CSV ${filePath}:`, error.message);
    return null;
  }
}

// Helper to parse dates from Excel
function parseExcelDate(value) {
  if (!value) return null;

  // If it's already a Date
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  // If it's an Excel serial date number
  if (typeof value === 'number') {
    // Excel dates are days since 1900-01-01 (with a bug for 1900 leap year)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }

  return null;
}

// Clean string value
function cleanString(value, maxLength = 255) {
  if (!value) return null;
  const str = String(value).trim();
  return str.length > maxLength ? str.substring(0, maxLength) : str;
}

// Import users (create default admin if none exists)
async function importUsers() {
  console.log('\n=== Importing Users ===');

  // Check if admin exists
  const existing = await query('SELECT id FROM users WHERE email = $1', ['admin@dmp.com']);

  if (existing.rows.length > 0) {
    console.log('Admin user already exists');
    return existing.rows[0].id;
  }

  const passwordHash = await bcrypt.hash('admin123', 10);

  const users = [
    { email: 'admin@dmp.com', name: 'System Administrator', role: 'admin' },
    { email: 'manager@dmp.com', name: 'Operations Manager', role: 'manager' },
    { email: 'staff@dmp.com', name: 'Staff Member', role: 'staff' },
  ];

  let adminId = null;

  for (const user of users) {
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [user.email, passwordHash, user.name, user.role]
    );
    if (user.role === 'admin') {
      adminId = result.rows[0].id;
    }
    console.log(`  Created/updated user: ${user.email}`);
  }

  return adminId;
}

// Import burials from Excel
async function importBurials() {
  console.log('\n=== Importing Burials ===');

  const data = readExcel(DATA_FILES.burials);
  if (!data) {
    console.log('  Burials file not found, skipping...');
    return;
  }

  console.log(`  Found sheets: ${data.sheetNames.join(', ')}`);

  // Try to find the main data sheet
  const sheetName = data.sheetNames[0];
  const rows = data.sheets[sheetName];

  if (!rows || rows.length === 0) {
    console.log('  No data found in burials file');
    return;
  }

  console.log(`  Found ${rows.length} burial records`);
  console.log(`  Sample columns: ${Object.keys(rows[0]).slice(0, 10).join(', ')}`);

  // Check if already imported
  const existingCount = await query('SELECT COUNT(*) FROM burials');
  const currentCount = parseInt(existingCount.rows[0].count, 10);
  
  if (currentCount > 30000) {
    console.log(`  Found ${currentCount} existing burials. Skipping import to avoid duplicates.`);
    return;
  }

  let imported = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const firstName = cleanString(
        row['Deceased First'] || row['deceased_first'] ||
        row['First Name'] || row['FirstName'] || row['FIRST_NAME'] ||
        row['Deceased First Name'] || row['deceased_first_name'] || ''
      );
      const lastName = cleanString(
        row['Deceased Last'] || row['deceased_last'] ||
        row['Last Name'] || row['LastName'] || row['LAST_NAME'] ||
        row['Deceased Last Name'] || row['deceased_last_name'] || ''
      );

      if (!firstName && !lastName) continue;

      const middleName = cleanString(
        row['Deceased Middle'] || row['deceased_middle'] ||
        row['Middle Name'] || row['MiddleName'] || row['MIDDLE_NAME'] ||
        row['deceased_middle_name'] || null
      );

      const burialDate = parseExcelDate(
        row['Interment Date'] || row['interment_date'] ||
        row['Burial Date'] || row['BurialDate'] || row['BURIAL_DATE'] ||
        row['burial_date'] || row['Date'] || null
      );

      const dateOfBirth = parseExcelDate(
        row['Birth Date'] || row['DOB'] || row['Date of Birth'] ||
        row['date_of_birth'] || null
      );

      const dateOfDeath = parseExcelDate(
        row['Death Date'] || row['DOD'] || row['Date of Death'] ||
        row['date_of_death'] || null
      );

      const section = cleanString(
        row['Section'] || row['section'] || row['SECTION'] ||
        row['Section Name'] || row['section_name'] || 'Unknown', 100
      );

      const lot = cleanString(
        row['Lot'] || row['lot'] || row['LOT'] || 'Unknown', 100
      );

      const grave = cleanString(
        row['Site'] || row['site'] || row['SITE'] ||
        row['Grave'] || row['GRAVE'] || row['grave'] ||
        row['Space'] || row['SPACE'] || 'Unknown', 100
      );

      const department = cleanString(
        row['Department'] || row['department'] || row['DEPARTMENT'] || null, 100
      );

      const plotLocation = cleanString(
        row['Plot Location'] || row['Location'] || row['LOCATION'] ||
        `${department ? department + '-' : ''}${section}-${lot}-${grave}`
      );

      const contactName = cleanString(
        row['Contact Name'] || row['Contact'] || row['Family Contact'] ||
        row['Site Name'] || row['site_name'] || null
      );

      const contactPhone = cleanString(
        row['Contact Phone'] || row['Phone'] || row['contact_phone'] || null, 50
      );

      const permitNumber = cleanString(
        row['Burial #'] || row['burial'] || row['Burial'] ||
        row['Permit Number'] || row['Permit'] || row['permit_number'] || null, 100
      );
      
      const burialDateStr = burialDate || new Date().toISOString().split('T')[0];

      await query(
        `INSERT INTO burials (
          deceased_first_name, deceased_last_name, deceased_middle_name,
          date_of_birth, date_of_death, burial_date, plot_location,
          section, lot, grave, contact_name, contact_phone, permit_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT DO NOTHING`,
        [
          firstName || 'Unknown',
          lastName || 'Unknown',
          middleName,
          dateOfBirth,
          dateOfDeath,
          burialDateStr,
          plotLocation,
          section,
          lot,
          grave,
          contactName,
          contactPhone,
          permitNumber,
        ]
      );
      
      imported++;
      if (imported % 1000 === 0) {
        console.log(`    Imported ${imported} burials...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`    Error importing burial: ${err.message}`);
      }
    }
  }

  console.log(`  Completed: ${imported} imported, ${errors} errors`);
}

// Import work orders from Excel
async function importWorkOrders(adminId) {
  console.log('\n=== Importing Work Orders ===');

  // Check if work orders already exist
  const existingCount = await query('SELECT COUNT(*) FROM work_orders');
  const currentCount = parseInt(existingCount.rows[0].count, 10);
  
  if (currentCount > 500) {
    console.log(`  Found ${currentCount} existing work orders. Skipping import to avoid duplicates.`);
    console.log(`  To re-import, clear the work_orders table first.`);
    return;
  }

  const data = readExcel(DATA_FILES.workOrders);
  if (!data) {
    console.log('  Work orders file not found, skipping...');
    return;
  }

  console.log(`  Found sheets: ${data.sheetNames.join(', ')}`);

  const sheetName = data.sheetNames[0];
  const rows = data.sheets[sheetName];

  if (!rows || rows.length === 0) {
    console.log('  No data found in work orders file');
    return;
  }

  console.log(`  Found ${rows.length} work order records`);
  console.log(`  Sample columns: ${Object.keys(rows[0]).slice(0, 10).join(', ')}`);

  let imported = 0;
  let errors = 0;
  let skipped = 0;

  // Valid types and priorities for the database
  const validTypes = ['maintenance', 'burial_prep', 'grounds', 'repair', 'other'];
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

  for (const row of rows) {
    try {
      const title = cleanString(
        row['Title'] || row['TITLE'] || row['title'] ||
        row['Description'] || row['Work Order'] || row['Task'] || 'Untitled'
      );

      const description = cleanString(
        row['Description'] || row['DESCRIPTION'] || row['description'] ||
        row['Notes'] || row['Details'] || null, 2000
      );

      // Map type
      let type = cleanString(
        row['Type'] || row['TYPE'] || row['type'] ||
        row['Category'] || row['CATEGORY'] || 'other', 50
      )?.toLowerCase();

      if (!validTypes.includes(type)) {
        if (type?.includes('maint')) type = 'maintenance';
        else if (type?.includes('burial') || type?.includes('prep')) type = 'burial_prep';
        else if (type?.includes('ground') || type?.includes('lawn')) type = 'grounds';
        else if (type?.includes('repair') || type?.includes('fix')) type = 'repair';
        else type = 'other';
      }

      // Map priority
      let priority = cleanString(
        row['Priority'] || row['PRIORITY'] || row['priority'] || 'medium', 50
      )?.toLowerCase();

      if (!validPriorities.includes(priority)) {
        if (priority?.includes('high') || priority?.includes('urgent')) priority = 'high';
        else if (priority?.includes('low')) priority = 'low';
        else priority = 'medium';
      }

      // Map status
      let status = cleanString(
        row['Status'] || row['STATUS'] || row['status'] || 'pending', 50
      )?.toLowerCase();

      if (!validStatuses.includes(status)) {
        if (status?.includes('complete') || status?.includes('done')) status = 'completed';
        else if (status?.includes('progress') || status?.includes('working')) status = 'in_progress';
        else if (status?.includes('cancel')) status = 'cancelled';
        else status = 'pending';
      }

      const dueDate = parseExcelDate(
        row['Due Date'] || row['DueDate'] || row['due_date'] || null
      );

      await query(
        `INSERT INTO work_orders (title, description, type, priority, status, due_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [title, description, type, priority, status, dueDate, adminId]
      );

      imported++;
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`    Error importing work order: ${err.message}`);
      }
    }
  }

  console.log(`  Completed: ${imported} imported, ${errors} errors`);
}

// Extract customers from burial records
async function extractCustomersFromBurials() {
  console.log('\n=== Extracting Customers from Burial Records ===');
  
  const result = await query(`
    SELECT DISTINCT 
      contact_name, contact_phone, contact_email,
      deceased_first_name, deceased_last_name
    FROM burials 
    WHERE (contact_name IS NOT NULL AND contact_name != '')
       OR (contact_phone IS NOT NULL AND contact_phone != '')
       OR (contact_email IS NOT NULL AND contact_email != '')
  `);
  
  if (result.rows.length === 0) {
    console.log('  No contact information found in burials');
    return;
  }
  
  console.log(`  Found ${result.rows.length} burial records with contact info`);
  
  let imported = 0;
  let skipped = 0;
  const seen = new Set();
  
  for (const row of result.rows) {
    try {
      // Use contact name if available, otherwise use deceased name
      const fullName = (row.contact_name || `${row.deceased_first_name} ${row.deceased_last_name}`).trim();
      if (!fullName || fullName === 'Unknown Unknown') continue;
      
      const nameParts = fullName.split(/\s+/).filter(p => p.length > 0);
      if (nameParts.length === 0) continue;
      
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';
      
      // Create unique key to avoid duplicates (use phone/email as primary identifier)
      const identifier = (row.contact_phone || row.contact_email || '').trim().toLowerCase();
      const key = identifier || `${firstName.toLowerCase()}_${lastName.toLowerCase()}`;
      
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      
      await query(
        `INSERT INTO customers (first_name, last_name, email, phone, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          firstName.substring(0, 255),
          lastName.substring(0, 255),
          cleanString(row.contact_email),
          cleanString(row.contact_phone, 50),
          `Extracted from burial record for ${row.deceased_first_name} ${row.deceased_last_name}`,
        ]
      );
      imported++;
      
      if (imported % 100 === 0) {
        console.log(`    Extracted ${imported} customers...`);
      }
    } catch (err) {
      skipped++;
    }
  }
  
  console.log(`  Extracted ${imported} customers, skipped ${skipped} duplicates`);
}

// Helper to find or create customer by name
async function findOrCreateCustomer(firstName, lastName, email, phone) {
  // Try to find existing customer
  let customer = await query(
    `SELECT id FROM customers 
     WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)
     LIMIT 1`,
    [firstName, lastName]
  );
  
  if (customer.rows.length > 0) {
    return customer.rows[0].id;
  }
  
  // Try by email
  if (email) {
    customer = await query(
      `SELECT id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (customer.rows.length > 0) {
      return customer.rows[0].id;
    }
  }
  
  // Try by phone
  if (phone) {
    customer = await query(
      `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    if (customer.rows.length > 0) {
      return customer.rows[0].id;
    }
  }
  
  // Create new customer
  const newCustomer = await query(
    `INSERT INTO customers (first_name, last_name, email, phone)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [firstName, lastName, email, phone]
  );
  
  return newCustomer.rows[0].id;
}

// Import accounts receivable from retail sales and financial package
async function importAccountsReceivable(adminId) {
  console.log('\n=== Importing Accounts Receivable ===');
  
  let totalImported = 0;
  let errors = 0;
  
  // Source 1: retail_sales_west_2020.xlsx - has clean transaction data
  // Columns: Date, Batch #, Dept - Sale #, Receipt #, Customer, Payment Type, Check/CC #, Amount, Status
  const retailData = readExcel(DATA_FILES.retailSales);
  if (retailData) {
    console.log('  Processing retail_sales_west_2020.xlsx...');
    
    // Use Sheet1_Prepared which has cleaner data
    const sheetName = retailData.sheetNames.includes('Sheet1_Prepared') ? 'Sheet1_Prepared' : retailData.sheetNames[0];
    const rows = retailData.sheets[sheetName] || [];
    console.log(`    Sheet: ${sheetName} (${rows.length} rows)`);
    
    for (const row of rows) {
      try {
        // Skip cancelled transactions or those already paid (they're deposits, not AR)
        const status = (row['Status'] || '').toLowerCase().trim();
        if (status === 'cancelled') continue;
        
        const amount = parseFloat(row['Amount']) || 0;
        if (amount <= 0) continue;
        
        // Create/get customer (DMP WEST is internal)
        const customerName = row['Customer'] || 'Walk-in Customer';
        let customerId;
        
        if (customerName === 'DMP WEST' || customerName === 'DMP EAST') {
          // These are retail sales - create generic customer
          const existing = await query(`SELECT id FROM customers WHERE first_name = 'Retail' AND last_name = 'Customer' LIMIT 1`);
          if (existing.rows.length > 0) {
            customerId = existing.rows[0].id;
          } else {
            const newCust = await query(`INSERT INTO customers (first_name, last_name) VALUES ('Retail', 'Customer') RETURNING id`);
            customerId = newCust.rows[0].id;
          }
        } else {
          customerId = await findOrCreateCustomer(customerName.split(' ')[0] || 'Customer', customerName.split(' ').slice(1).join(' ') || 'Unknown', null, null);
        }
        
        const receiptNum = row['Receipt #'] || row['Dept - Sale #'] || `RET-${Date.now()}-${totalImported}`;
        const saleDate = parseExcelDate(row['Date']) || new Date().toISOString().split('T')[0];
        const dueDate = new Date(saleDate);
        dueDate.setDate(dueDate.getDate() + 30);
        
        // If status is 'Paid', it's already collected. AR should track unpaid.
        // But we'll import as 'paid' to have historical record
        const arStatus = status === 'paid' ? 'paid' : 'pending';
        
        await query(
          `INSERT INTO accounts_receivable (customer_id, invoice_number, amount, due_date, status)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [customerId, receiptNum, amount, dueDate.toISOString().split('T')[0], arStatus]
        );
        
        totalImported++;
      } catch (err) {
        errors++;
      }
    }
  }
  
  // Source 2: ULTIMATE_FINANCIAL_PACKAGE.xlsx - "Accounts Payable Data" sheet (actually contains contracts/AR data)
  // Columns: Contract, Date, Trans.Type, Product, amounts, customer names
  const finData = readExcel(DATA_FILES.financialPackage);
  if (finData && finData.sheets['Accounts Payable Data']) {
    console.log('  Processing ULTIMATE_FINANCIAL_PACKAGE - Accounts Payable Data...');
    const rows = finData.sheets['Accounts Payable Data'] || [];
    console.log(`    Found ${rows.length} rows`);
    
    for (const row of rows) {
      try {
        // Look for customer name in various columns
        const customerName = row['Customer'] || row['Name'] || '';
        if (!customerName || typeof customerName !== 'string') continue;
        
        // Get amount from Undeposited Funds or A/R columns
        const amount = Math.abs(parseFloat(row['Undeposited Funds']) || parseFloat(row['A/R']) || 0);
        if (amount <= 0) continue;
        
        // Parse customer name (format: "LAST, FIRST")
        const nameParts = customerName.split(',').map(s => s.trim());
        const lastName = nameParts[0] || 'Unknown';
        const firstName = nameParts[1] || 'Customer';
        
        const customerId = await findOrCreateCustomer(firstName, lastName, null, null);
        
        const contractNum = row['Contract'] || `CON-${Date.now()}-${totalImported}`;
        const transDate = parseExcelDate(row['Date']) || new Date().toISOString().split('T')[0];
        const dueDate = new Date(transDate);
        dueDate.setDate(dueDate.getDate() + 30);
        
        const transType = (row['Trans.Type'] || '').toLowerCase();
        const arStatus = transType.includes('paid') ? 'paid' : 'pending';
        
        await query(
          `INSERT INTO accounts_receivable (customer_id, invoice_number, amount, due_date, status)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [customerId, contractNum, amount, dueDate.toISOString().split('T')[0], arStatus]
        );
        
        totalImported++;
      } catch (err) {
        errors++;
      }
    }
  }
  
  console.log(`  Imported ${totalImported} accounts receivable records (${errors} errors)`);
}

// Helper to find or create vendor
async function findOrCreateVendor(name, cache = new Map()) {
  if (cache.has(name)) {
    return cache.get(name);
  }
  
  // Try to find existing vendor (case-insensitive)
  let vendor = await query(
    `SELECT id FROM vendors WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  
  if (vendor.rows.length > 0) {
    cache.set(name, vendor.rows[0].id);
    return vendor.rows[0].id;
  }
  
  // Create new vendor
  const newVendor = await query(
    `INSERT INTO vendors (name) VALUES ($1) RETURNING id`,
    [name]
  );
  
  const vendorId = newVendor.rows[0].id;
  cache.set(name, vendorId);
  return vendorId;
}

// Import accounts payable from vendor bills CSV (Zoom2Day format)
async function importAccountsPayable() {
  console.log('\n=== Importing Accounts Payable ===');
  
  const rows = readCSV(DATA_FILES.vendorBills);
  
  if (!rows || rows.length === 0) {
    console.log('  Vendor bills file not found, skipping...');
    return;
  }
  
  console.log(`  Found ${rows.length} vendor bill records`);
  
  let vendorsCreated = 0;
  let apImported = 0;
  let errors = 0;
  const vendorCache = new Map();
  const processedDocs = new Set();
  
  // Filter to AP_TRADE lines only
  const apRows = rows.filter(r => r.LineRole === 'AP_TRADE');
  console.log(`  Found ${apRows.length} AP_TRADE rows to process`);
  
  for (const row of apRows) {
    try {
      const vendorName = cleanString(row['VendorName']);
      if (!vendorName) continue;
      
      // Get or create vendor
      let vendorId = vendorCache.get(vendorName);
      
      if (!vendorId) {
        // Try to find existing vendor first
        const existing = await query('SELECT id FROM vendors WHERE name = $1', [vendorName]);
        if (existing.rows.length > 0) {
          vendorId = existing.rows[0].id;
        } else {
          // Create new vendor
          const vendorResult = await query(
            `INSERT INTO vendors (name, notes) VALUES ($1, $2) RETURNING id`,
            [vendorName, row['VendorCode'] ? `Code: ${row['VendorCode']}` : null]
          );
          vendorId = vendorResult.rows[0].id;
          vendorsCreated++;
        }
        vendorCache.set(vendorName, vendorId);
      }
      
      // Get amount from BillTotal (most reliable)
      const finalAmount = parseFloat(row['BillTotal']) || parseFloat(row['Amount']) || parseFloat(row['DR']) || 0;
      if (finalAmount <= 0) continue;
      
      // Invoice number
      const invoiceNumber = row['DocumentNo'] || `AP-${Date.now()}-${apImported}`;
      
      // Skip duplicates
      const docKey = `${vendorName}-${invoiceNumber}`;
      if (processedDocs.has(docKey)) continue;
      processedDocs.add(docKey);
      
      // Parse date
      const billDate = parseExcelDate(row['PostingDate']) || new Date().toISOString().split('T')[0];
      const dueDate = new Date(billDate);
      dueDate.setDate(dueDate.getDate() + 30);
      
      // Status
      const status = (row['Status'] || '').toLowerCase().includes('complete') ? 'paid' : 'pending';
      
      // Insert AP record
      await query(
        `INSERT INTO accounts_payable (vendor_id, invoice_number, amount, due_date, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [vendorId, invoiceNumber, finalAmount, dueDate.toISOString().split('T')[0], status]
      );
      
      apImported++;
    } catch (err) {
      errors++;
      if (errors <= 3) {
        console.log(`    Error: ${err.message}`);
      }
    }
  }
  
  console.log(`  Created ${vendorsCreated} new vendors, imported ${apImported} AP records (${errors} errors)`);
}

// Import deposits from retail sales and financial package
async function importDeposits(adminId) {
  console.log('\n=== Importing Deposits ===');
  
  let totalImported = 0;
  let errors = 0;
  
  // Source 1: retail_sales_west_2020.xlsx - Paid transactions are deposits
  const retailData = readExcel(DATA_FILES.retailSales);
  if (retailData) {
    console.log('  Processing retail_sales_west_2020.xlsx (paid transactions)...');
    
    const sheetName = retailData.sheetNames.includes('Sheet1_Prepared') ? 'Sheet1_Prepared' : retailData.sheetNames[0];
    const rows = retailData.sheets[sheetName] || [];
    
    for (const row of rows) {
      try {
        // Only import paid transactions as deposits
        const status = (row['Status'] || '').toLowerCase().trim();
        if (status !== 'paid') continue;
        
        const amount = parseFloat(row['Amount']) || 0;
        if (amount <= 0) continue;
        
        const depositDate = parseExcelDate(row['Date']) || new Date().toISOString().split('T')[0];
        
        // Determine payment method
        const paymentType = (row['Payment Type'] || '').toLowerCase();
        let method = 'other';
        if (paymentType.includes('credit') || paymentType.includes('card') || paymentType.includes('cc')) method = 'credit_card';
        else if (paymentType.includes('check')) method = 'check';
        else if (paymentType.includes('cash')) method = 'cash';
        else if (paymentType.includes('money order') || paymentType.includes('m/o')) method = 'check';
        
        const reference = row['Receipt #'] || row['Batch #'] || row['Check/CC #'] || null;
        
        await query(
          `INSERT INTO deposits (amount, date, method, reference, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [amount, depositDate, method, reference, adminId]
        );
        
        totalImported++;
      } catch (err) {
        errors++;
      }
    }
  }
  
  // Source 2: ULTIMATE_FINANCIAL_PACKAGE - Deposits Data sheet
  const finData = readExcel(DATA_FILES.financialPackage);
  if (finData && finData.sheets['Deposits Data']) {
    console.log('  Processing ULTIMATE_FINANCIAL_PACKAGE - Deposits Data...');
    const rows = finData.sheets['Deposits Data'] || [];
    console.log(`    Found ${rows.length} rows`);
    
    for (const row of rows) {
      try {
        // Get deposit amount from Bank Deposit column or sum of payment types
        const bankDeposit = parseFloat(row['Bank Deposit'] || row['Bank'] || row['Huntg'] || row['Beta'] || 0);
        const ccAmt = parseFloat(row['CC'] || row['Credit Card'] || 0);
        const checkAmt = parseFloat(row['Check Amt'] || row['Check'] || 0);
        const moAmt = parseFloat(row['M/O'] || row['Money Order'] || 0);
        const cashAmt = parseFloat(row['Cash Amt'] || row['Cash'] || row['Cash '] || 0);
        
        const amount = bankDeposit > 0 ? bankDeposit : (ccAmt + checkAmt + moAmt + cashAmt);
        if (amount <= 0) continue;
        
        const depositDate = parseExcelDate(row['Report Date'] || row['Date'] || row['Report']) || new Date().toISOString().split('T')[0];
        
        // Determine method based on which amount was used
        let method = 'other';
        if (ccAmt > 0) method = 'credit_card';
        else if (checkAmt > 0 || moAmt > 0) method = 'check';
        else if (cashAmt > 0) method = 'cash';
        
        const reference = row['Batch#'] || row['Type'] || null;
        
        await query(
          `INSERT INTO deposits (amount, date, method, reference, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [amount, depositDate, method, reference, adminId]
        );
        
        totalImported++;
      } catch (err) {
        errors++;
      }
    }
  }
  
  console.log(`  Imported ${totalImported} deposit records (${errors} errors)`);
}

// Import inventory from sales/retail data
async function importInventoryFromSales() {
  console.log('\n=== Importing Inventory from Sales Data ===');
  
  const data = readExcel(DATA_FILES.retailSales) ||
               readExcel(DATA_FILES.salesApp) ||
               readExcel(DATA_FILES.accountsReceivable);
  
  if (!data) {
    console.log('  Sales data files not found, skipping...');
    return;
  }
  
  console.log(`  Found sheets: ${data.sheetNames.join(', ')}`);
  
  const itemMap = new Map();
  
  for (const sheetName of data.sheetNames) {
    const rows = data.sheets[sheetName];
    if (!rows || rows.length === 0) continue;
    
    const lowerName = sheetName.toLowerCase();
    if (!lowerName.includes('sale') && !lowerName.includes('item') && 
        !lowerName.includes('product') && !lowerName.includes('retail')) {
      continue;
    }
    
    console.log(`  Processing sheet: ${sheetName} (${rows.length} rows)`);
    
    for (const row of rows) {
      const itemName = cleanString(
        row['Item'] || row['Product'] || row['Description'] || 
        row['Item Name'] || row['Name'] || null
      );
      
      if (!itemName) continue;
      
      const price = parseFloat(
        row['Price'] || row['Unit Price'] || row['Cost'] || 
        row['Sale Price'] || 0
      );
      
      if (itemMap.has(itemName)) {
        const existing = itemMap.get(itemName);
        existing.price = Math.max(existing.price, price);
        existing.count++;
      } else {
        itemMap.set(itemName, {
          name: itemName,
          price: price,
          count: 1,
          category: inferCategory(itemName),
        });
      }
    }
  }
  
  console.log(`  Found ${itemMap.size} unique items`);
  
  let imported = 0;
  
  for (const [name, item] of itemMap.entries()) {
    try {
      await query(
        `INSERT INTO inventory (name, category, unit_price, quantity, reorder_point)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          name,
          item.category,
          item.price || 0,
          0, // Start with 0 quantity
          5, // Default reorder point
        ]
      );
      imported++;
    } catch (err) {
      // Skip errors
    }
  }
  
  console.log(`  Imported ${imported} inventory items from sales data`);
}

// Infer inventory category from item name
function inferCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes('casket') || lower.includes('coffin')) return 'casket';
  if (lower.includes('urn')) return 'urn';
  if (lower.includes('vault') || lower.includes('liner')) return 'vault';
  if (lower.includes('marker') || lower.includes('monument') || lower.includes('headstone') || lower.includes('tombstone')) return 'marker';
  if (lower.includes('flower') || lower.includes('wreath') || lower.includes('arrangement')) return 'supplies';
  return 'other';
}

// Import from Master Data Package (customers, vendors, inventory, etc.)
async function importMasterData(adminId) {
  console.log('\n=== Importing Master Data ===');

  const data = readExcel(DATA_FILES.masterData) || readExcel(DATA_FILES.finalMaster);
  if (!data) {
    console.log('  Master data file not found, skipping...');
    return;
  }

  console.log(`  Found sheets: ${data.sheetNames.join(', ')}`);

  // Process each sheet based on name
  for (const sheetName of data.sheetNames) {
    const rows = data.sheets[sheetName];
    if (!rows || rows.length === 0) continue;

    const lowerName = sheetName.toLowerCase();

    console.log(`  Processing sheet: ${sheetName} (${rows.length} rows)`);
    console.log(`    Columns: ${Object.keys(rows[0]).slice(0, 8).join(', ')}`);

    if (lowerName.includes('customer') || lowerName.includes('contact') || lowerName.includes('family')) {
      await importCustomersFromSheet(rows);
    } else if (lowerName.includes('vendor') || lowerName.includes('supplier')) {
      await importVendorsFromSheet(rows);
    } else if (lowerName.includes('inventory') || lowerName.includes('product') || lowerName.includes('item')) {
      await importInventoryFromSheet(rows);
    } else if (lowerName.includes('contract')) {
      await importContractsFromSheet(rows);
    } else if (lowerName.includes('grant') || lowerName.includes('benefit') || lowerName.includes('funding')) {
      await importGrantsFromSheet(rows);
    }
  }
}

async function importCustomersFromSheet(rows) {
  console.log('    Importing customers...');
  let imported = 0;

  for (const row of rows) {
    try {
      const firstName = cleanString(
        row['First Name'] || row['FirstName'] || row['first_name'] ||
        row['Name']?.split(' ')[0] || ''
      );
      const lastName = cleanString(
        row['Last Name'] || row['LastName'] || row['last_name'] ||
        row['Name']?.split(' ').slice(1).join(' ') || ''
      );

      if (!firstName && !lastName) continue;

      await query(
        `INSERT INTO customers (first_name, last_name, email, phone, address, city, state, zip_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          firstName || 'Unknown',
          lastName || 'Unknown',
          cleanString(row['Email'] || row['email'] || null),
          cleanString(row['Phone'] || row['phone'] || row['Telephone'] || null, 50),
          cleanString(row['Address'] || row['address'] || row['Street'] || null, 500),
          cleanString(row['City'] || row['city'] || null, 100),
          cleanString(row['State'] || row['state'] || 'MI', 50),
          cleanString(row['Zip'] || row['ZIP'] || row['zip_code'] || row['Postal Code'] || null, 20),
        ]
      );
      imported++;
    } catch (err) {
      // Skip duplicates silently
    }
  }
  console.log(`      Imported ${imported} customers`);
}

async function importVendorsFromSheet(rows) {
  console.log('    Importing vendors...');
  let imported = 0;

  for (const row of rows) {
    try {
      const name = cleanString(
        row['Name'] || row['Vendor Name'] || row['Company'] || row['vendor_name'] || ''
      );

      if (!name) continue;

      await query(
        `INSERT INTO vendors (name, contact_name, email, phone, address)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          name,
          cleanString(row['Contact'] || row['Contact Name'] || null),
          cleanString(row['Email'] || row['email'] || null),
          cleanString(row['Phone'] || row['phone'] || null, 50),
          cleanString(row['Address'] || row['address'] || null, 500),
        ]
      );
      imported++;
    } catch (err) {
      // Skip duplicates
    }
  }
  console.log(`      Imported ${imported} vendors`);
}

async function importInventoryFromSheet(rows) {
  console.log('    Importing inventory...');
  let imported = 0;

  const validCategories = ['casket', 'urn', 'vault', 'marker', 'supplies', 'other'];

  for (const row of rows) {
    try {
      const name = cleanString(
        row['Name'] || row['Item Name'] || row['Product'] || row['Description'] || ''
      );

      if (!name) continue;

      let category = cleanString(
        row['Category'] || row['Type'] || row['category'] || 'other', 50
      )?.toLowerCase();

      if (!validCategories.includes(category)) {
        if (category?.includes('casket') || category?.includes('coffin')) category = 'casket';
        else if (category?.includes('urn')) category = 'urn';
        else if (category?.includes('vault') || category?.includes('liner')) category = 'vault';
        else if (category?.includes('marker') || category?.includes('monument') || category?.includes('headstone')) category = 'marker';
        else if (category?.includes('supply') || category?.includes('supplies')) category = 'supplies';
        else category = 'other';
      }

      const quantity = parseInt(row['Quantity'] || row['Qty'] || row['Stock'] || 0) || 0;
      const reorderPoint = parseInt(row['Reorder Point'] || row['Min Stock'] || row['reorder_point'] || 5) || 5;
      const unitPrice = parseFloat(row['Price'] || row['Unit Price'] || row['Cost'] || 0) || 0;

      await query(
        `INSERT INTO inventory (name, category, sku, quantity, reorder_point, unit_price, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          name,
          category,
          cleanString(row['SKU'] || row['sku'] || row['Item Number'] || null, 100),
          quantity,
          reorderPoint,
          unitPrice,
          cleanString(row['Location'] || row['Warehouse'] || null),
        ]
      );
      imported++;
    } catch (err) {
      // Skip errors
    }
  }
  console.log(`      Imported ${imported} inventory items`);
}

async function importContractsFromSheet(rows) {
  console.log('    Importing contracts...');
  // Contracts require customer references - would need more complex logic
  console.log('      Skipped (requires customer mapping)');
}

async function importGrantsFromSheet(rows) {
  console.log('    Importing grants...');
  let imported = 0;

  const validTypes = ['grant', 'benefit', 'opportunity'];
  const validStatuses = ['available', 'applied', 'approved', 'denied', 'received'];

  for (const row of rows) {
    try {
      const title = cleanString(
        row['Title'] || row['Name'] || row['Grant Name'] || row['Program'] || ''
      );

      if (!title) continue;

      let type = cleanString(
        row['Type'] || row['type'] || 'grant', 50
      )?.toLowerCase();

      if (!validTypes.includes(type)) {
        if (type?.includes('benefit')) type = 'benefit';
        else if (type?.includes('opportunity')) type = 'opportunity';
        else type = 'grant';
      }

      let status = cleanString(
        row['Status'] || row['status'] || 'available', 50
      )?.toLowerCase();

      if (!validStatuses.includes(status)) {
        status = 'available';
      }

      await query(
        `INSERT INTO grants (title, description, type, source, amount, deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [
          title,
          cleanString(row['Description'] || row['description'] || null, 5000),
          type,
          cleanString(row['Source'] || row['Organization'] || row['Funder'] || 'Unknown'),
          parseFloat(row['Amount'] || row['amount'] || 0) || null,
          parseExcelDate(row['Deadline'] || row['Due Date'] || null),
          status,
        ]
      );
      imported++;
    } catch (err) {
      // Skip errors
    }
  }
  console.log(`      Imported ${imported} grants`);
}

// Create standard cemetery inventory items
async function createStandardInventory() {
  console.log('\n=== Creating Standard Inventory ===');
  
  const result = await query('SELECT COUNT(*) FROM inventory');
  if (parseInt(result.rows[0].count) > 0) {
    console.log(`  Inventory already has ${result.rows[0].count} items`);
    return;
  }
  
  const items = [
    // Caskets
    { name: 'Oak Casket - Standard', category: 'casket', qty: 5, reorder: 2, price: 2500, sku: 'CAS-OAK-STD' },
    { name: 'Oak Casket - Premium', category: 'casket', qty: 3, reorder: 1, price: 4500, sku: 'CAS-OAK-PRM' },
    { name: 'Mahogany Casket - Deluxe', category: 'casket', qty: 2, reorder: 1, price: 6500, sku: 'CAS-MAH-DLX' },
    { name: 'Steel Casket - Bronze Finish', category: 'casket', qty: 4, reorder: 2, price: 3200, sku: 'CAS-STL-BRZ' },
    { name: 'Poplar Casket - Economy', category: 'casket', qty: 8, reorder: 3, price: 1200, sku: 'CAS-POP-ECO' },
    { name: 'Pine Casket - Basic', category: 'casket', qty: 6, reorder: 2, price: 800, sku: 'CAS-PIN-BAS' },
    // Urns
    { name: 'Bronze Urn - Classic', category: 'urn', qty: 10, reorder: 4, price: 450, sku: 'URN-BRZ-CLS' },
    { name: 'Marble Urn - White', category: 'urn', qty: 6, reorder: 2, price: 650, sku: 'URN-MRB-WHT' },
    { name: 'Wood Urn - Cherry', category: 'urn', qty: 8, reorder: 3, price: 350, sku: 'URN-WOD-CHR' },
    { name: 'Biodegradable Urn - Green', category: 'urn', qty: 12, reorder: 5, price: 150, sku: 'URN-BIO-GRN' },
    { name: 'Ceramic Urn - Blue', category: 'urn', qty: 5, reorder: 2, price: 275, sku: 'URN-CER-BLU' },
    { name: 'Companion Urn - Double', category: 'urn', qty: 3, reorder: 1, price: 750, sku: 'URN-CMP-DBL' },
    // Vaults
    { name: 'Concrete Vault - Standard', category: 'vault', qty: 15, reorder: 5, price: 1200, sku: 'VLT-CON-STD' },
    { name: 'Concrete Vault - Premium', category: 'vault', qty: 8, reorder: 3, price: 1800, sku: 'VLT-CON-PRM' },
    { name: 'Steel Vault - Bronze', category: 'vault', qty: 4, reorder: 2, price: 3500, sku: 'VLT-STL-BRZ' },
    { name: 'Urn Vault - Single', category: 'vault', qty: 10, reorder: 4, price: 400, sku: 'VLT-URN-SGL' },
    // Markers
    { name: 'Granite Marker - Flat', category: 'marker', qty: 20, reorder: 8, price: 800, sku: 'MRK-GRN-FLT' },
    { name: 'Granite Marker - Upright', category: 'marker', qty: 10, reorder: 4, price: 2500, sku: 'MRK-GRN-UPR' },
    { name: 'Bronze Marker - Flush', category: 'marker', qty: 15, reorder: 6, price: 1200, sku: 'MRK-BRZ-FLU' },
    { name: 'VA Bronze Marker', category: 'marker', qty: 25, reorder: 10, price: 0, sku: 'MRK-VA-BRZ' },
    { name: 'Companion Marker - Double', category: 'marker', qty: 5, reorder: 2, price: 3500, sku: 'MRK-CMP-DBL' },
    // Supplies
    { name: 'Grave Liner - Concrete', category: 'supplies', qty: 30, reorder: 10, price: 400, sku: 'SUP-LNR-CON' },
    { name: 'Lowering Device - Standard', category: 'supplies', qty: 3, reorder: 1, price: 2500, sku: 'SUP-LOW-STD' },
    { name: 'Grass Seed - 50lb Bag', category: 'supplies', qty: 20, reorder: 5, price: 75, sku: 'SUP-GRS-50' },
    { name: 'Flower Vase - Bronze', category: 'supplies', qty: 50, reorder: 20, price: 45, sku: 'SUP-VAS-BRZ' },
    { name: 'Memorial Wreath Stand', category: 'supplies', qty: 10, reorder: 4, price: 85, sku: 'SUP-WRT-STD' },
    { name: 'Tent - 10x10 Green', category: 'supplies', qty: 4, reorder: 1, price: 350, sku: 'SUP-TNT-GRN' },
    { name: 'Chairs - Folding (Set of 20)', category: 'supplies', qty: 5, reorder: 2, price: 400, sku: 'SUP-CHR-20' },
    { name: 'Artificial Grass Mat', category: 'supplies', qty: 15, reorder: 5, price: 125, sku: 'SUP-GRS-ART' },
  ];
  
  let imported = 0;
  for (const item of items) {
    try {
      await query(
        `INSERT INTO inventory (name, category, quantity, reorder_point, unit_price, sku, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [item.name, item.category, item.qty, item.reorder, item.price, item.sku, 'Main Warehouse']
      );
      imported++;
    } catch (err) {
      // Skip duplicates
    }
  }
  console.log(`  Created ${imported} standard inventory items`);
}

// Create standard grants and benefits
async function createStandardGrants() {
  console.log('\n=== Creating Standard Grants & Benefits ===');
  
  const result = await query('SELECT COUNT(*) FROM grants');
  if (parseInt(result.rows[0].count) > 0) {
    console.log(`  Grants already exist (${result.rows[0].count} records)`);
    return;
  }
  
  const standardGrants = [
    {
      title: 'VA Burial Allowance',
      description: 'Veterans Administration burial allowance for eligible veterans. Covers burial and funeral costs up to the maximum amount.',
      type: 'benefit',
      source: 'U.S. Department of Veterans Affairs',
      amount: 2000,
      status: 'available',
    },
    {
      title: 'VA Plot Allowance',
      description: 'VA plot allowance for veterans not buried in a national cemetery.',
      type: 'benefit',
      source: 'U.S. Department of Veterans Affairs',
      amount: 893,
      status: 'available',
    },
    {
      title: 'VA Headstone/Marker',
      description: 'Free government headstone or marker for eligible veterans.',
      type: 'benefit',
      source: 'U.S. Department of Veterans Affairs',
      amount: 0,
      status: 'available',
    },
    {
      title: 'Social Security Lump Sum Death Payment',
      description: 'One-time payment to eligible surviving spouse or child.',
      type: 'benefit',
      source: 'Social Security Administration',
      amount: 255,
      status: 'available',
    },
    {
      title: 'Michigan Indigent Burial Program',
      description: 'State assistance for burial costs for indigent residents of Michigan.',
      type: 'benefit',
      source: 'State of Michigan',
      amount: 1500,
      status: 'available',
    },
    {
      title: 'Historic Cemetery Preservation Grant',
      description: 'Grants for preservation and restoration of historic cemeteries in Michigan.',
      type: 'grant',
      source: 'Michigan History Center',
      amount: 25000,
      status: 'available',
    },
    {
      title: 'Community Foundation Grant',
      description: 'Local foundation grants for cemetery improvements and community programs.',
      type: 'grant',
      source: 'Community Foundation for Southeast Michigan',
      amount: 10000,
      status: 'available',
    },
    {
      title: 'Green Burial Initiative Grant',
      description: 'Funding for implementing environmentally sustainable burial practices.',
      type: 'opportunity',
      source: 'Green Burial Council',
      amount: 15000,
      status: 'available',
    },
    {
      title: 'Veteran Memorial Park Enhancement',
      description: 'Grants for enhancing veteran memorial sections and monuments.',
      type: 'grant',
      source: 'American Legion',
      amount: 5000,
      status: 'available',
    },
    {
      title: 'Cemetery Technology Modernization',
      description: 'Funding for digital record keeping, mapping systems, and management software.',
      type: 'opportunity',
      source: 'Michigan Economic Development Corporation',
      amount: 50000,
      status: 'available',
    },
  ];
  
  let imported = 0;
  for (const grant of standardGrants) {
    try {
      await query(
        `INSERT INTO grants (title, description, type, source, amount, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [grant.title, grant.description, grant.type, grant.source, grant.amount, grant.status]
      );
      imported++;
    } catch (err) {
      // Skip duplicates
    }
  }
  console.log(`  Created ${imported} standard grants/benefits`);
}

// Main import function
async function runImport() {
  console.log('='.repeat(60));
  console.log('Detroit Memorial Park - Data Import');
  console.log('='.repeat(60));
  console.log(`\nData directory: ${DATA_DIR}`);
  console.log('');

  try {
    // Import in order (dependencies first)
    const adminId = await importUsers();
    
    // Core data
    await importBurials();
    await importWorkOrders(adminId);
    
    // Extract customers from burials (needed for financial records)
    await extractCustomersFromBurials();
    
    // Master data (customers, vendors, inventory, grants)
    await importMasterData(adminId);
    
    // Create standard grants/benefits
    await createStandardGrants();
    
    // Financial data (needs customers and vendors)
    await importAccountsReceivable(adminId);
    await importAccountsPayable();
    await importDeposits(adminId);
    
    // Inventory from sales data or create standard items
    await importInventoryFromSales();
    await createStandardInventory();

    console.log('\n' + '='.repeat(60));
    console.log('Import Complete!');
    console.log('='.repeat(60));

    // Show counts
    const counts = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM customers'),
      query('SELECT COUNT(*) FROM vendors'),
      query('SELECT COUNT(*) FROM burials'),
      query('SELECT COUNT(*) FROM work_orders'),
      query('SELECT COUNT(*) FROM inventory'),
      query('SELECT COUNT(*) FROM grants'),
      query('SELECT COUNT(*) FROM accounts_receivable'),
      query('SELECT COUNT(*) FROM accounts_payable'),
      query('SELECT COUNT(*) FROM deposits'),
    ]);

    console.log('\nDatabase Summary:');
    console.log(`  Users:              ${counts[0].rows[0].count}`);
    console.log(`  Customers:          ${counts[1].rows[0].count}`);
    console.log(`  Vendors:            ${counts[2].rows[0].count}`);
    console.log(`  Burials:            ${counts[3].rows[0].count}`);
    console.log(`  Work Orders:        ${counts[4].rows[0].count}`);
    console.log(`  Inventory Items:    ${counts[5].rows[0].count}`);
    console.log(`  Grants:             ${counts[6].rows[0].count}`);
    console.log(`  Accounts Receivable: ${counts[7].rows[0].count}`);
    console.log(`  Accounts Payable:   ${counts[8].rows[0].count}`);
    console.log(`  Deposits:           ${counts[9].rows[0].count}`);

  } catch (error) {
    console.error('\nImport failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the import
runImport();
