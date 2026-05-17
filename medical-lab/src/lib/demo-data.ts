/**
 * Seed data for LabCore LIMS demo mode.
 * Produces a coherent cross-referenced dataset.
 * Dates use Date.now() - N*86400000 so charts always look recent.
 */

import type {
  Patient, Provider, StaffMember, TestCatalogItem, TestOrder, OrderItem,
  Specimen, TestResult, Instrument, Reagent, Invoice, InsuranceClaim, QCRun,
  QCResult,
} from '../types';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}
function dateOnly(n: number): string {
  return daysAgo(n).slice(0, 10);
}

const uuid = (): string => crypto.randomUUID();

// Pre-minted IDs so we can cross-reference
const IDS = {
  // patients
  p1: uuid(), p2: uuid(), p3: uuid(), p4: uuid(), p5: uuid(), p6: uuid(), p7: uuid(), p8: uuid(),
  // providers
  pr1: uuid(), pr2: uuid(), pr3: uuid(), pr4: uuid(), pr5: uuid(),
  // staff
  s1: uuid(), s2: uuid(), s3: uuid(), s4: uuid(), s5: uuid(), s6: uuid(), s7: uuid(),
  // catalog items
  c1: uuid(), c2: uuid(), c3: uuid(), c4: uuid(), c5: uuid(), c6: uuid(), c7: uuid(),
  c8: uuid(), c9: uuid(), c10: uuid(), c11: uuid(), c12: uuid(), c13: uuid(), c14: uuid(),
  c15: uuid(), c16: uuid(), c17: uuid(), c18: uuid(), c19: uuid(), c20: uuid(),
  // panel component refs (c1 is CBC panel containing c2+c3+c4+c5)
  // orders
  o1: uuid(), o2: uuid(), o3: uuid(), o4: uuid(), o5: uuid(),
  o6: uuid(), o7: uuid(), o8: uuid(), o9: uuid(), o10: uuid(),
  // instruments
  i1: uuid(), i2: uuid(), i3: uuid(), i4: uuid(), i5: uuid(), i6: uuid(),
  // invoices
  inv1: uuid(), inv2: uuid(), inv3: uuid(), inv4: uuid(), inv5: uuid(),
  inv6: uuid(), inv7: uuid(), inv8: uuid(), inv9: uuid(), inv10: uuid(),
  // claims
  cl1: uuid(), cl2: uuid(), cl3: uuid(), cl4: uuid(), cl5: uuid(), cl6: uuid(),
};

export function seedDb() {
  const now = new Date().toISOString();

  // ---- PATIENTS ----
  const patients: Patient[] = [
    { id: IDS.p1, mrn: 'MRN-00001', firstName: 'Eleanor', lastName: 'Vasquez', dateOfBirth: '1968-04-12', sex: 'female', phone: '(313) 555-0101', email: 'e.vasquez@example.com', address: '412 Maple St', city: 'Detroit', state: 'MI', zipCode: '48201', insuranceProvider: 'BlueCross BlueShield', insurancePolicyNumber: 'BCB-12345', insuranceGroupNumber: 'GRP-001', createdAt: daysAgo(120), updatedAt: daysAgo(3) },
    { id: IDS.p2, mrn: 'MRN-00002', firstName: 'Marcus', lastName: 'Thornton', dateOfBirth: '1952-11-28', sex: 'male', phone: '(313) 555-0102', email: 'mthornton@example.com', address: '78 Oak Ave', city: 'Dearborn', state: 'MI', zipCode: '48124', insuranceProvider: 'Medicare', insurancePolicyNumber: 'MED-67890', createdAt: daysAgo(90), updatedAt: daysAgo(5) },
    { id: IDS.p3, mrn: 'MRN-00003', firstName: 'Priya', lastName: 'Nair', dateOfBirth: '1985-07-03', sex: 'female', phone: '(248) 555-0103', email: 'priya.nair@example.com', city: 'Troy', state: 'MI', zipCode: '48084', insuranceProvider: 'Aetna', insurancePolicyNumber: 'AET-11111', createdAt: daysAgo(60), updatedAt: daysAgo(10) },
    { id: IDS.p4, mrn: 'MRN-00004', firstName: 'James', lastName: 'Okafor', dateOfBirth: '1972-02-19', sex: 'male', phone: '(734) 555-0104', city: 'Ann Arbor', state: 'MI', zipCode: '48104', insuranceProvider: 'United Health', insurancePolicyNumber: 'UH-22222', createdAt: daysAgo(45), updatedAt: daysAgo(7) },
    { id: IDS.p5, mrn: 'MRN-00005', firstName: 'Sofia', lastName: 'Reyes', dateOfBirth: '1990-09-14', sex: 'female', phone: '(313) 555-0105', email: 'sofia.r@example.com', city: 'Detroit', state: 'MI', zipCode: '48202', insuranceProvider: 'Cigna', insurancePolicyNumber: 'CGN-33333', createdAt: daysAgo(30), updatedAt: daysAgo(2) },
    { id: IDS.p6, mrn: 'MRN-00006', firstName: 'Robert', lastName: 'Chen', dateOfBirth: '1943-06-30', sex: 'male', phone: '(586) 555-0106', city: 'Sterling Heights', state: 'MI', zipCode: '48310', insuranceProvider: 'Medicare', insurancePolicyNumber: 'MED-44444', createdAt: daysAgo(25), updatedAt: daysAgo(1) },
    { id: IDS.p7, mrn: 'MRN-00007', firstName: 'Amara', lastName: 'Williams', dateOfBirth: '2001-01-08', sex: 'female', phone: '(313) 555-0107', city: 'Detroit', state: 'MI', zipCode: '48205', createdAt: daysAgo(15), updatedAt: daysAgo(15) },
    { id: IDS.p8, mrn: 'MRN-00008', firstName: 'David', lastName: 'Kowalski', dateOfBirth: '1961-12-25', sex: 'male', phone: '(248) 555-0108', city: 'Pontiac', state: 'MI', zipCode: '48342', insuranceProvider: 'BlueCross BlueShield', insurancePolicyNumber: 'BCB-55555', createdAt: daysAgo(10), updatedAt: daysAgo(10) },
  ];

  // ---- PROVIDERS ----
  const providers: Provider[] = [
    { id: IDS.pr1, npi: '1234567890', firstName: 'Anita', lastName: 'Patel', credentials: 'MD', organization: 'Detroit Internal Medicine', specialty: 'Internal Medicine', phone: '(313) 555-0201', fax: '(313) 555-0299', email: 'apatel@dim.example.com', status: 'active', createdAt: daysAgo(200), updatedAt: daysAgo(20) },
    { id: IDS.pr2, npi: '0987654321', firstName: 'Thomas', lastName: 'Brewer', credentials: 'MD, FACP', organization: 'Great Lakes Cardiology', specialty: 'Cardiology', phone: '(248) 555-0202', fax: '(248) 555-0298', status: 'active', createdAt: daysAgo(180), updatedAt: daysAgo(30) },
    { id: IDS.pr3, npi: '1122334455', firstName: 'Lisa', lastName: 'Huang', credentials: 'DO', organization: 'Michigan Family Health', specialty: 'Family Medicine', phone: '(734) 555-0203', status: 'active', createdAt: daysAgo(150), updatedAt: daysAgo(45) },
    { id: IDS.pr4, npi: '5544332211', firstName: 'Carlos', lastName: 'Mendez', credentials: 'MD', organization: 'Wayne Endocrinology', specialty: 'Endocrinology', phone: '(313) 555-0204', status: 'active', createdAt: daysAgo(100), updatedAt: daysAgo(60) },
    { id: IDS.pr5, npi: '9988776655', firstName: 'Rachel', lastName: 'Kim', credentials: 'MD, PhD', organization: 'University Hospital', specialty: 'Hematology', phone: '(734) 555-0205', status: 'inactive', createdAt: daysAgo(365), updatedAt: daysAgo(90) },
  ];

  // ---- STAFF ----
  const staff: StaffMember[] = [
    { id: IDS.s1, firstName: 'Diana', lastName: 'Foster', email: 'd.foster@lab.example.com', role: 'lab_director', licenseNumber: 'LD-0001', licenseType: 'MD', licenseExpiry: '2027-12-31', department: 'general', phone: '(313) 555-0301', status: 'active', hireDate: '2018-03-01', createdAt: daysAgo(365*2), updatedAt: daysAgo(30) },
    { id: IDS.s2, firstName: 'Kevin', lastName: 'Marsh', email: 'k.marsh@lab.example.com', role: 'medical_technologist', licenseNumber: 'MT-1234', licenseType: 'MT(ASCP)', licenseExpiry: '2025-06-30', department: 'chemistry', phone: '(313) 555-0302', status: 'active', hireDate: '2020-07-15', createdAt: daysAgo(365*1.5), updatedAt: daysAgo(7) },
    { id: IDS.s3, firstName: 'Nadia', lastName: 'Russo', email: 'n.russo@lab.example.com', role: 'technician', licenseNumber: 'MLT-5678', licenseType: 'MLT(ASCP)', licenseExpiry: '2026-03-31', department: 'hematology', status: 'active', hireDate: '2021-01-10', createdAt: daysAgo(365), updatedAt: daysAgo(14) },
    { id: IDS.s4, firstName: 'Jerome', lastName: 'Banks', email: 'j.banks@lab.example.com', role: 'phlebotomist', licenseNumber: 'PHL-9012', licenseType: 'CPT', licenseExpiry: '2025-12-31', department: 'phlebotomy', phone: '(313) 555-0304', status: 'active', hireDate: '2022-04-01', createdAt: daysAgo(300), updatedAt: daysAgo(5) },
    { id: IDS.s5, firstName: 'Grace', lastName: 'Osei', email: 'g.osei@lab.example.com', role: 'supervisor', department: 'microbiology', phone: '(313) 555-0305', status: 'active', hireDate: '2019-09-01', createdAt: daysAgo(365*2), updatedAt: daysAgo(20) },
    { id: IDS.s6, firstName: 'Tyler', lastName: 'Hunt', email: 't.hunt@lab.example.com', role: 'admin', department: 'general', phone: '(313) 555-0306', status: 'on_leave', hireDate: '2021-06-15', createdAt: daysAgo(250), updatedAt: daysAgo(2) },
    { id: IDS.s7, firstName: 'Mei', lastName: 'Zhang', email: 'm.zhang@lab.example.com', role: 'medical_technologist', licenseNumber: 'MT-3456', licenseType: 'MT(ASCP)', licenseExpiry: '2024-12-31', department: 'immunology', status: 'active', hireDate: '2020-11-01', createdAt: daysAgo(400), updatedAt: daysAgo(3) },
  ];

  // ---- TEST CATALOG ----
  const testCatalog: TestCatalogItem[] = [
    // Individual tests
    { id: IDS.c2, code: 'WBC', name: 'White Blood Cell Count', loincCode: '6690-2', cptCode: '85025', category: 'hematology', specimenType: 'blood', turnaroundHours: 2, price: 18, unit: '×10³/µL', referenceRangeLow: 4.5, referenceRangeHigh: 11.0, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c3, code: 'RBC', name: 'Red Blood Cell Count', loincCode: '789-8', cptCode: '85025', category: 'hematology', specimenType: 'blood', turnaroundHours: 2, price: 18, unit: '×10⁶/µL', referenceRangeLow: 4.0, referenceRangeHigh: 5.5, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c4, code: 'HGB', name: 'Hemoglobin', loincCode: '718-7', cptCode: '85025', category: 'hematology', specimenType: 'blood', turnaroundHours: 2, price: 18, unit: 'g/dL', referenceRangeLow: 12.0, referenceRangeHigh: 17.5, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c5, code: 'PLT', name: 'Platelet Count', loincCode: '777-3', cptCode: '85025', category: 'hematology', specimenType: 'blood', turnaroundHours: 2, price: 18, unit: '×10³/µL', referenceRangeLow: 150, referenceRangeHigh: 400, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c6, code: 'GLUCOSE', name: 'Glucose', loincCode: '2345-7', cptCode: '82947', category: 'chemistry', specimenType: 'serum', turnaroundHours: 1, price: 25, unit: 'mg/dL', referenceRangeLow: 70, referenceRangeHigh: 100, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c7, code: 'CREAT', name: 'Creatinine', loincCode: '2160-0', cptCode: '82565', category: 'chemistry', specimenType: 'serum', turnaroundHours: 2, price: 22, unit: 'mg/dL', referenceRangeLow: 0.6, referenceRangeHigh: 1.2, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c8, code: 'NA', name: 'Sodium', loincCode: '2951-2', cptCode: '84295', category: 'chemistry', specimenType: 'serum', turnaroundHours: 1, price: 20, unit: 'mEq/L', referenceRangeLow: 136, referenceRangeHigh: 145, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c9, code: 'K', name: 'Potassium', loincCode: '2823-3', cptCode: '84132', category: 'chemistry', specimenType: 'serum', turnaroundHours: 1, price: 20, unit: 'mEq/L', referenceRangeLow: 3.5, referenceRangeHigh: 5.0, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c10, code: 'TSH', name: 'Thyroid Stimulating Hormone', loincCode: '3016-3', cptCode: '84443', category: 'immunology', specimenType: 'serum', turnaroundHours: 4, price: 65, unit: 'µIU/mL', referenceRangeLow: 0.4, referenceRangeHigh: 4.0, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c11, code: 'UA', name: 'Urinalysis Complete', loincCode: '24356-8', cptCode: '81001', category: 'urinalysis', specimenType: 'urine', turnaroundHours: 2, price: 35, referenceRangeText: 'See report', isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c12, code: 'STREP', name: 'Group A Streptococcus Rapid', loincCode: '11268-0', cptCode: '87880', category: 'microbiology', specimenType: 'swab', turnaroundHours: 1, price: 45, referenceRangeText: 'Negative', isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c13, code: 'HBA1C', name: 'Hemoglobin A1c', loincCode: '4548-4', cptCode: '83036', category: 'chemistry', specimenType: 'blood', turnaroundHours: 4, price: 55, unit: '%', referenceRangeLow: 0, referenceRangeHigh: 5.6, referenceRangeText: 'Normal <5.7%', isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c14, code: 'LFT', name: 'ALT (Liver Function)', loincCode: '1742-6', cptCode: '84460', category: 'chemistry', specimenType: 'serum', turnaroundHours: 3, price: 30, unit: 'U/L', referenceRangeLow: 7, referenceRangeHigh: 56, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c15, code: 'LIPID', name: 'Total Cholesterol', loincCode: '2093-3', cptCode: '82465', category: 'chemistry', specimenType: 'serum', turnaroundHours: 3, price: 28, unit: 'mg/dL', referenceRangeLow: 0, referenceRangeHigh: 200, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c16, code: 'COVID-PCR', name: 'SARS-CoV-2 PCR', loincCode: '94500-6', cptCode: '87635', category: 'molecular', specimenType: 'swab', turnaroundHours: 6, price: 95, referenceRangeText: 'Negative (Not Detected)', isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c17, code: 'UCULTURE', name: 'Urine Culture', loincCode: '630-7', cptCode: '87086', category: 'microbiology', specimenType: 'urine', turnaroundHours: 48, price: 58, referenceRangeText: 'No growth', isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c18, code: 'PTH', name: 'Parathyroid Hormone', loincCode: '2731-8', cptCode: '83970', category: 'immunology', specimenType: 'serum', turnaroundHours: 8, price: 85, unit: 'pg/mL', referenceRangeLow: 10, referenceRangeHigh: 65, isPanel: false, active: true, createdAt: now, updatedAt: now },
    { id: IDS.c19, code: 'LYME-AB', name: 'Lyme Disease Antibody', loincCode: '5127-6', cptCode: '86617', category: 'immunology', specimenType: 'serum', turnaroundHours: 24, price: 72, referenceRangeText: 'Negative', isPanel: false, active: true, createdAt: now, updatedAt: now },
    // Panels
    { id: IDS.c1, code: 'CBC', name: 'Complete Blood Count with Differential', loincCode: '57021-8', cptCode: '85025', category: 'panel', specimenType: 'blood', turnaroundHours: 2, price: 65, referenceRangeText: 'See individual results', isPanel: true, panelComponentIds: [IDS.c2, IDS.c3, IDS.c4, IDS.c5], active: true, createdAt: now, updatedAt: now },
    { id: IDS.c20, code: 'CMP', name: 'Comprehensive Metabolic Panel', loincCode: '24323-8', cptCode: '80053', category: 'panel', specimenType: 'serum', turnaroundHours: 3, price: 120, referenceRangeText: 'See individual results', isPanel: true, panelComponentIds: [IDS.c6, IDS.c7, IDS.c8, IDS.c9, IDS.c14], active: true, createdAt: now, updatedAt: now },
  ];

  // ---- INSTRUMENTS ----
  const instruments: Instrument[] = [
    { id: IDS.i1, name: 'Sysmex XN-1000', manufacturer: 'Sysmex', model: 'XN-1000', serialNumber: 'SYS-A12345', category: 'hematology', location: 'Hematology Bay A', status: 'operational', lastMaintenanceDate: dateOnly(30), nextMaintenanceDate: dateOnly(-5), lastCalibrationDate: dateOnly(14), nextCalibrationDate: dateOnly(76), installDate: '2021-01-15', createdAt: daysAgo(365), updatedAt: daysAgo(5) },
    { id: IDS.i2, name: 'Beckman AU5800', manufacturer: 'Beckman Coulter', model: 'AU5800', serialNumber: 'BCK-B67890', category: 'chemistry', location: 'Chemistry Lab 1', status: 'operational', lastMaintenanceDate: dateOnly(21), nextMaintenanceDate: dateOnly(69), lastCalibrationDate: dateOnly(7), nextCalibrationDate: dateOnly(83), installDate: '2020-06-01', createdAt: daysAgo(400), updatedAt: daysAgo(7) },
    { id: IDS.i3, name: 'Cepheid GeneXpert', manufacturer: 'Cepheid', model: 'GeneXpert Infinity-48', serialNumber: 'CEP-C11111', category: 'molecular', location: 'Molecular Lab', status: 'operational', lastMaintenanceDate: dateOnly(60), nextMaintenanceDate: dateOnly(30), lastCalibrationDate: dateOnly(30), nextCalibrationDate: dateOnly(60), installDate: '2022-03-10', createdAt: daysAgo(300), updatedAt: daysAgo(2) },
    { id: IDS.i4, name: 'BioMerieux VITEK 2', manufacturer: 'BioMerieux', model: 'VITEK 2 COMPACT', serialNumber: 'BIO-D22222', category: 'microbiology', location: 'Micro Lab B', status: 'maintenance', lastMaintenanceDate: dateOnly(90), nextMaintenanceDate: dateOnly(-2), installDate: '2019-08-20', notes: 'Scheduled maintenance in progress', createdAt: daysAgo(500), updatedAt: daysAgo(1) },
    { id: IDS.i5, name: 'Siemens IMMULITE 2000', manufacturer: 'Siemens', model: 'IMMULITE 2000 XPi', serialNumber: 'SIE-E33333', category: 'immunology', location: 'Immunology Bay', status: 'operational', lastMaintenanceDate: dateOnly(45), nextMaintenanceDate: dateOnly(45), lastCalibrationDate: dateOnly(10), nextCalibrationDate: dateOnly(80), installDate: '2021-11-01', createdAt: daysAgo(200), updatedAt: daysAgo(10) },
    { id: IDS.i6, name: 'Roche Cobas 8000', manufacturer: 'Roche', model: 'Cobas 8000', serialNumber: 'ROC-F44444', category: 'chemistry', location: 'Chemistry Lab 2', status: 'calibration', lastCalibrationDate: dateOnly(1), nextCalibrationDate: dateOnly(-1), notes: 'Monthly QC calibration', createdAt: daysAgo(150), updatedAt: daysAgo(0) },
  ];

  // ---- ORDERS ----
  const orderItems1: OrderItem[] = [
    { id: uuid(), orderId: IDS.o1, testCatalogId: IDS.c1, testName: 'Complete Blood Count with Differential', price: 65, status: 'resulted', createdAt: daysAgo(12), updatedAt: daysAgo(11) },
    { id: uuid(), orderId: IDS.o1, testCatalogId: IDS.c20, testName: 'Comprehensive Metabolic Panel', price: 120, status: 'resulted', createdAt: daysAgo(12), updatedAt: daysAgo(11) },
  ];
  const orderItems2: OrderItem[] = [
    { id: uuid(), orderId: IDS.o2, testCatalogId: IDS.c10, testName: 'Thyroid Stimulating Hormone', price: 65, status: 'resulted', createdAt: daysAgo(10), updatedAt: daysAgo(9) },
    { id: uuid(), orderId: IDS.o2, testCatalogId: IDS.c13, testName: 'Hemoglobin A1c', price: 55, status: 'resulted', createdAt: daysAgo(10), updatedAt: daysAgo(9) },
  ];
  const orderItems3: OrderItem[] = [
    { id: uuid(), orderId: IDS.o3, testCatalogId: IDS.c16, testName: 'SARS-CoV-2 PCR', price: 95, status: 'in_progress', createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  ];
  const orderItems4: OrderItem[] = [
    { id: uuid(), orderId: IDS.o4, testCatalogId: IDS.c6, testName: 'Glucose', price: 25, status: 'resulted', createdAt: daysAgo(7), updatedAt: daysAgo(6) },
    { id: uuid(), orderId: IDS.o4, testCatalogId: IDS.c7, testName: 'Creatinine', price: 22, status: 'resulted', createdAt: daysAgo(7), updatedAt: daysAgo(6) },
    { id: uuid(), orderId: IDS.o4, testCatalogId: IDS.c11, testName: 'Urinalysis Complete', price: 35, status: 'resulted', createdAt: daysAgo(7), updatedAt: daysAgo(6) },
  ];
  const orderItems5: OrderItem[] = [
    { id: uuid(), orderId: IDS.o5, testCatalogId: IDS.c1, testName: 'Complete Blood Count with Differential', price: 65, status: 'in_progress', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: uuid(), orderId: IDS.o5, testCatalogId: IDS.c15, testName: 'Total Cholesterol', price: 28, status: 'pending', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  ];
  const orderItems6: OrderItem[] = [
    { id: uuid(), orderId: IDS.o6, testCatalogId: IDS.c12, testName: 'Group A Streptococcus Rapid', price: 45, status: 'resulted', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
  ];
  const orderItems7: OrderItem[] = [
    { id: uuid(), orderId: IDS.o7, testCatalogId: IDS.c18, testName: 'Parathyroid Hormone', price: 85, status: 'pending', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { id: uuid(), orderId: IDS.o7, testCatalogId: IDS.c8, testName: 'Sodium', price: 20, status: 'pending', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { id: uuid(), orderId: IDS.o7, testCatalogId: IDS.c9, testName: 'Potassium', price: 20, status: 'pending', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  ];
  const orderItems8: OrderItem[] = [
    { id: uuid(), orderId: IDS.o8, testCatalogId: IDS.c17, testName: 'Urine Culture', price: 58, status: 'in_progress', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
  ];
  const orderItems9: OrderItem[] = [
    { id: uuid(), orderId: IDS.o9, testCatalogId: IDS.c19, testName: 'Lyme Disease Antibody', price: 72, status: 'resulted', createdAt: daysAgo(14), updatedAt: daysAgo(13) },
    { id: uuid(), orderId: IDS.o9, testCatalogId: IDS.c1, testName: 'Complete Blood Count with Differential', price: 65, status: 'resulted', createdAt: daysAgo(14), updatedAt: daysAgo(13) },
  ];
  const orderItems10: OrderItem[] = [
    { id: uuid(), orderId: IDS.o10, testCatalogId: IDS.c6, testName: 'Glucose', price: 25, status: 'cancelled', createdAt: daysAgo(20), updatedAt: daysAgo(19) },
  ];

  const orders: TestOrder[] = [
    { id: IDS.o1, orderNumber: 'ORD-2026-0001', patientId: IDS.p1, providerId: IDS.pr1, priority: 'routine', status: 'completed', orderedDate: dateOnly(12), icd10Codes: ['Z00.00', 'E11.9'], items: orderItems1, createdAt: daysAgo(12), updatedAt: daysAgo(11) },
    { id: IDS.o2, orderNumber: 'ORD-2026-0002', patientId: IDS.p2, providerId: IDS.pr2, priority: 'routine', status: 'completed', orderedDate: dateOnly(10), icd10Codes: ['E03.9'], items: orderItems2, createdAt: daysAgo(10), updatedAt: daysAgo(9) },
    { id: IDS.o3, orderNumber: 'ORD-2026-0003', patientId: IDS.p3, providerId: IDS.pr3, priority: 'stat', status: 'in_progress', orderedDate: dateOnly(3), clinicalNotes: 'Symptomatic - fever, cough', icd10Codes: ['Z11.52'], items: orderItems3, createdAt: daysAgo(3), updatedAt: daysAgo(3) },
    { id: IDS.o4, orderNumber: 'ORD-2026-0004', patientId: IDS.p4, providerId: IDS.pr4, priority: 'routine', status: 'resulted', orderedDate: dateOnly(7), icd10Codes: ['N18.3', 'E11.9'], items: orderItems4, createdAt: daysAgo(7), updatedAt: daysAgo(6) },
    { id: IDS.o5, orderNumber: 'ORD-2026-0005', patientId: IDS.p5, providerId: IDS.pr1, priority: 'asap', status: 'in_progress', orderedDate: dateOnly(1), clinicalNotes: 'Pre-op panel', items: orderItems5, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: IDS.o6, orderNumber: 'ORD-2026-0006', patientId: IDS.p6, providerId: IDS.pr3, priority: 'stat', status: 'resulted', orderedDate: dateOnly(5), clinicalNotes: 'Sore throat, fever 39°C', icd10Codes: ['J02.0'], items: orderItems6, createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { id: IDS.o7, orderNumber: 'ORD-2026-0007', patientId: IDS.p7, providerId: IDS.pr4, priority: 'routine', status: 'ordered', orderedDate: dateOnly(0), icd10Codes: ['E21.3'], items: orderItems7, createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { id: IDS.o8, orderNumber: 'ORD-2026-0008', patientId: IDS.p8, providerId: IDS.pr1, priority: 'routine', status: 'received', orderedDate: dateOnly(2), icd10Codes: ['N39.0'], items: orderItems8, createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { id: IDS.o9, orderNumber: 'ORD-2026-0009', patientId: IDS.p1, providerId: IDS.pr2, priority: 'routine', status: 'completed', orderedDate: dateOnly(14), icd10Codes: ['A69.20'], items: orderItems9, createdAt: daysAgo(14), updatedAt: daysAgo(13) },
    { id: IDS.o10, orderNumber: 'ORD-2026-0010', patientId: IDS.p2, providerId: IDS.pr3, priority: 'routine', status: 'cancelled', orderedDate: dateOnly(20), notes: 'Patient declined', items: orderItems10, createdAt: daysAgo(20), updatedAt: daysAgo(19) },
  ] as any;

  // ---- SPECIMENS ----
  const specId = (n: number) => `ACC-2026-${String(n).padStart(4, '0')}`;
  const specimens: Specimen[] = [
    { id: uuid(), accessionNumber: specId(1), orderId: IDS.o1, patientId: IDS.p1, specimenType: 'blood', status: 'stored', collectedBy: IDS.s4, collectionDate: dateOnly(12), receivedDate: dateOnly(12), storageLocation: 'Freezer A-3', createdAt: daysAgo(12), updatedAt: daysAgo(12) },
    { id: uuid(), accessionNumber: specId(2), orderId: IDS.o1, patientId: IDS.p1, specimenType: 'serum', status: 'stored', collectedBy: IDS.s4, collectionDate: dateOnly(12), receivedDate: dateOnly(12), storageLocation: 'Freezer A-3', createdAt: daysAgo(12), updatedAt: daysAgo(12) },
    { id: uuid(), accessionNumber: specId(3), orderId: IDS.o2, patientId: IDS.p2, specimenType: 'serum', status: 'disposed', collectedBy: IDS.s4, collectionDate: dateOnly(10), receivedDate: dateOnly(10), createdAt: daysAgo(10), updatedAt: daysAgo(5) },
    { id: uuid(), accessionNumber: specId(4), orderId: IDS.o3, patientId: IDS.p3, specimenType: 'swab', status: 'received', collectionDate: dateOnly(3), receivedDate: dateOnly(3), storageLocation: 'Molecular Lab Fridge', createdAt: daysAgo(3), updatedAt: daysAgo(3) },
    { id: uuid(), accessionNumber: specId(5), orderId: IDS.o4, patientId: IDS.p4, specimenType: 'serum', status: 'stored', collectedBy: IDS.s4, collectionDate: dateOnly(7), receivedDate: dateOnly(7), storageLocation: 'Chem Fridge B', createdAt: daysAgo(7), updatedAt: daysAgo(7) },
    { id: uuid(), accessionNumber: specId(6), orderId: IDS.o4, patientId: IDS.p4, specimenType: 'urine', status: 'disposed', collectionDate: dateOnly(7), receivedDate: dateOnly(7), createdAt: daysAgo(7), updatedAt: daysAgo(4) },
    { id: uuid(), accessionNumber: specId(7), orderId: IDS.o5, patientId: IDS.p5, specimenType: 'blood', status: 'received', collectedBy: IDS.s4, collectionDate: dateOnly(1), receivedDate: dateOnly(1), createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: uuid(), accessionNumber: specId(8), orderId: IDS.o6, patientId: IDS.p6, specimenType: 'swab', status: 'rejected', collectionDate: dateOnly(5), rejectionReason: 'insufficient_volume', rejectionNotes: 'Swab was dry on arrival', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { id: uuid(), accessionNumber: specId(9), orderId: IDS.o6, patientId: IDS.p6, specimenType: 'swab', status: 'stored', collectedBy: IDS.s4, collectionDate: dateOnly(5), receivedDate: dateOnly(5), storageLocation: 'Micro Lab Fridge', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { id: uuid(), accessionNumber: specId(10), orderId: IDS.o8, patientId: IDS.p8, specimenType: 'urine', status: 'received', collectionDate: dateOnly(2), receivedDate: dateOnly(2), createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { id: uuid(), accessionNumber: specId(11), orderId: IDS.o9, patientId: IDS.p1, specimenType: 'serum', status: 'disposed', collectedBy: IDS.s4, collectionDate: dateOnly(14), receivedDate: dateOnly(14), createdAt: daysAgo(14), updatedAt: daysAgo(10) },
    { id: uuid(), accessionNumber: specId(12), orderId: IDS.o9, patientId: IDS.p1, specimenType: 'blood', status: 'disposed', collectedBy: IDS.s4, collectionDate: dateOnly(14), receivedDate: dateOnly(14), createdAt: daysAgo(14), updatedAt: daysAgo(10) },
    { id: uuid(), accessionNumber: specId(13), orderId: IDS.o7, patientId: IDS.p7, specimenType: 'serum', status: 'pending_collection', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { id: uuid(), accessionNumber: specId(14), orderId: IDS.o7, patientId: IDS.p7, specimenType: 'blood', status: 'pending_collection', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  ];

  // ---- RESULTS ----
  const results: TestResult[] = [
    // Order 1 CBC (c1 panel) — slightly abnormal values
    { id: uuid(), orderId: IDS.o1, orderItemId: orderItems1[0].id, specimenId: specimens[0].id, testCatalogId: IDS.c2, patientId: IDS.p1, resultValue: '12.3', unit: '×10³/µL', referenceRange: '4.5-11.0', flag: 'high', status: 'verified', performedBy: IDS.s3, verifiedBy: IDS.s2, resultDate: dateOnly(11), verifiedDate: dateOnly(11), instrumentId: IDS.i1, createdAt: daysAgo(11), updatedAt: daysAgo(11) },
    { id: uuid(), orderId: IDS.o1, orderItemId: orderItems1[0].id, specimenId: specimens[0].id, testCatalogId: IDS.c3, patientId: IDS.p1, resultValue: '3.8', unit: '×10⁶/µL', referenceRange: '4.0-5.5', flag: 'low', status: 'verified', performedBy: IDS.s3, verifiedBy: IDS.s2, resultDate: dateOnly(11), verifiedDate: dateOnly(11), instrumentId: IDS.i1, createdAt: daysAgo(11), updatedAt: daysAgo(11) },
    { id: uuid(), orderId: IDS.o1, orderItemId: orderItems1[0].id, specimenId: specimens[0].id, testCatalogId: IDS.c4, patientId: IDS.p1, resultValue: '10.2', unit: 'g/dL', referenceRange: '12.0-17.5', flag: 'low', status: 'verified', performedBy: IDS.s3, verifiedBy: IDS.s2, resultDate: dateOnly(11), verifiedDate: dateOnly(11), instrumentId: IDS.i1, createdAt: daysAgo(11), updatedAt: daysAgo(11) },
    { id: uuid(), orderId: IDS.o1, orderItemId: orderItems1[0].id, specimenId: specimens[0].id, testCatalogId: IDS.c5, patientId: IDS.p1, resultValue: '215', unit: '×10³/µL', referenceRange: '150-400', flag: 'normal', status: 'verified', performedBy: IDS.s3, verifiedBy: IDS.s2, resultDate: dateOnly(11), verifiedDate: dateOnly(11), instrumentId: IDS.i1, createdAt: daysAgo(11), updatedAt: daysAgo(11) },
    // Order 1 CMP
    { id: uuid(), orderId: IDS.o1, orderItemId: orderItems1[1].id, specimenId: specimens[1].id, testCatalogId: IDS.c6, patientId: IDS.p1, resultValue: '245', unit: 'mg/dL', referenceRange: '70-100', flag: 'critical_high', status: 'verified', performedBy: IDS.s2, verifiedBy: IDS.s1, resultDate: dateOnly(11), verifiedDate: dateOnly(11), instrumentId: IDS.i2, notes: 'Patient fasting status unknown', createdAt: daysAgo(11), updatedAt: daysAgo(11) },
    { id: uuid(), orderId: IDS.o1, orderItemId: orderItems1[1].id, specimenId: specimens[1].id, testCatalogId: IDS.c7, patientId: IDS.p1, resultValue: '1.1', unit: 'mg/dL', referenceRange: '0.6-1.2', flag: 'normal', status: 'verified', performedBy: IDS.s2, verifiedBy: IDS.s1, resultDate: dateOnly(11), verifiedDate: dateOnly(11), instrumentId: IDS.i2, createdAt: daysAgo(11), updatedAt: daysAgo(11) },
    // Order 2 TSH + HbA1c
    { id: uuid(), orderId: IDS.o2, orderItemId: orderItems2[0].id, specimenId: specimens[2].id, testCatalogId: IDS.c10, patientId: IDS.p2, resultValue: '8.2', unit: 'µIU/mL', referenceRange: '0.4-4.0', flag: 'high', status: 'verified', performedBy: IDS.s7, verifiedBy: IDS.s1, resultDate: dateOnly(9), verifiedDate: dateOnly(9), instrumentId: IDS.i5, createdAt: daysAgo(9), updatedAt: daysAgo(9) },
    { id: uuid(), orderId: IDS.o2, orderItemId: orderItems2[1].id, specimenId: specimens[2].id, testCatalogId: IDS.c13, patientId: IDS.p2, resultValue: '7.8', unit: '%', referenceRange: '<5.7%', flag: 'high', status: 'verified', performedBy: IDS.s2, verifiedBy: IDS.s1, resultDate: dateOnly(9), verifiedDate: dateOnly(9), instrumentId: IDS.i2, createdAt: daysAgo(9), updatedAt: daysAgo(9) },
    // Order 4 (multiple)
    { id: uuid(), orderId: IDS.o4, orderItemId: orderItems4[0].id, specimenId: specimens[4].id, testCatalogId: IDS.c6, patientId: IDS.p4, resultValue: '310', unit: 'mg/dL', referenceRange: '70-100', flag: 'critical_high', status: 'verified', performedBy: IDS.s2, verifiedBy: IDS.s1, resultDate: dateOnly(6), verifiedDate: dateOnly(6), instrumentId: IDS.i2, createdAt: daysAgo(6), updatedAt: daysAgo(6) },
    { id: uuid(), orderId: IDS.o4, orderItemId: orderItems4[1].id, specimenId: specimens[4].id, testCatalogId: IDS.c7, patientId: IDS.p4, resultValue: '2.8', unit: 'mg/dL', referenceRange: '0.6-1.2', flag: 'critical_high', status: 'verified', performedBy: IDS.s2, verifiedBy: IDS.s1, resultDate: dateOnly(6), verifiedDate: dateOnly(6), instrumentId: IDS.i2, createdAt: daysAgo(6), updatedAt: daysAgo(6) },
    { id: uuid(), orderId: IDS.o4, orderItemId: orderItems4[2].id, specimenId: specimens[5].id, testCatalogId: IDS.c11, patientId: IDS.p4, resultValue: 'Abnormal', referenceRange: 'See report', flag: 'abnormal', status: 'verified', performedBy: IDS.s3, verifiedBy: IDS.s2, resultDate: dateOnly(6), verifiedDate: dateOnly(6), createdAt: daysAgo(6), updatedAt: daysAgo(6) },
    // Order 6 strep
    { id: uuid(), orderId: IDS.o6, orderItemId: orderItems6[0].id, specimenId: specimens[8].id, testCatalogId: IDS.c12, patientId: IDS.p6, resultValue: 'Positive', referenceRange: 'Negative', flag: 'abnormal', status: 'verified', performedBy: IDS.s3, verifiedBy: IDS.s5, resultDate: dateOnly(5), verifiedDate: dateOnly(5), createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    // Order 9 lyme + CBC
    { id: uuid(), orderId: IDS.o9, orderItemId: orderItems9[0].id, specimenId: specimens[10].id, testCatalogId: IDS.c19, patientId: IDS.p1, resultValue: 'Negative', referenceRange: 'Negative', flag: 'normal', status: 'verified', performedBy: IDS.s7, verifiedBy: IDS.s1, resultDate: dateOnly(13), verifiedDate: dateOnly(13), instrumentId: IDS.i5, createdAt: daysAgo(13), updatedAt: daysAgo(13) },
    { id: uuid(), orderId: IDS.o9, orderItemId: orderItems9[1].id, specimenId: specimens[11].id, testCatalogId: IDS.c4, patientId: IDS.p1, resultValue: '13.5', unit: 'g/dL', referenceRange: '12.0-17.5', flag: 'normal', status: 'verified', performedBy: IDS.s3, verifiedBy: IDS.s2, resultDate: dateOnly(13), verifiedDate: dateOnly(13), instrumentId: IDS.i1, createdAt: daysAgo(13), updatedAt: daysAgo(13) },
    // Order 5 CBC — preliminary
    { id: uuid(), orderId: IDS.o5, orderItemId: orderItems5[0].id, specimenId: specimens[6].id, testCatalogId: IDS.c4, patientId: IDS.p5, resultValue: '9.1', unit: 'g/dL', referenceRange: '12.0-17.5', flag: 'low', status: 'pending_verification', performedBy: IDS.s3, resultDate: dateOnly(1), instrumentId: IDS.i1, createdAt: daysAgo(1), updatedAt: daysAgo(1) },
  ];

  // ---- REAGENTS ----
  const reagents: Reagent[] = [
    { id: uuid(), name: 'CBC Diluent Pack', catalogNumber: 'SYS-REA-001', lotNumber: 'LOT-ABC123', manufacturer: 'Sysmex', category: 'reagent', quantityOnHand: 45, unit: 'pack', reorderPoint: 20, expirationDate: dateOnly(-90), storageLocation: 'Hematology Supply Room', instrumentId: IDS.i1, status: 'in_stock', createdAt: daysAgo(60), updatedAt: daysAgo(5) },
    { id: uuid(), name: 'Chemistry Control Level 1', catalogNumber: 'BCK-CTL-L1', lotNumber: 'LOT-DEF456', manufacturer: 'Beckman Coulter', category: 'control', quantityOnHand: 3, unit: 'vial', reorderPoint: 5, expirationDate: dateOnly(-30), storageLocation: 'Chem Fridge B', instrumentId: IDS.i2, status: 'low_stock', createdAt: daysAgo(90), updatedAt: daysAgo(1) },
    { id: uuid(), name: 'Chemistry Control Level 2', catalogNumber: 'BCK-CTL-L2', lotNumber: 'LOT-GHI789', manufacturer: 'Beckman Coulter', category: 'control', quantityOnHand: 8, unit: 'vial', reorderPoint: 5, expirationDate: dateOnly(-60), storageLocation: 'Chem Fridge B', instrumentId: IDS.i2, status: 'in_stock', createdAt: daysAgo(90), updatedAt: daysAgo(1) },
    { id: uuid(), name: 'TSH Calibrator Set', catalogNumber: 'SIE-TSH-CAL', lotNumber: 'LOT-JKL012', manufacturer: 'Siemens', category: 'calibrator', quantityOnHand: 2, unit: 'set', reorderPoint: 2, expirationDate: dateOnly(-14), storageLocation: 'Immunology Fridge', instrumentId: IDS.i5, status: 'low_stock', createdAt: daysAgo(45), updatedAt: daysAgo(2) },
    { id: uuid(), name: 'GeneXpert COVID Cartridge', catalogNumber: 'CEP-COVID-48', lotNumber: 'LOT-MNO345', manufacturer: 'Cepheid', category: 'kit', quantityOnHand: 120, unit: 'cartridge', reorderPoint: 50, expirationDate: dateOnly(-180), storageLocation: 'Molecular Lab Cabinet', instrumentId: IDS.i3, status: 'in_stock', createdAt: daysAgo(30), updatedAt: daysAgo(3) },
    { id: uuid(), name: 'Blood Culture Bottles (Aerobic)', catalogNumber: 'BIO-BC-AER', lotNumber: 'LOT-PQR678', manufacturer: 'BioMerieux', category: 'kit', quantityOnHand: 60, unit: 'bottle', reorderPoint: 40, expirationDate: dateOnly(-120), storageLocation: 'Micro Lab Cabinet A', instrumentId: IDS.i4, status: 'in_stock', createdAt: daysAgo(45), updatedAt: daysAgo(10) },
    { id: uuid(), name: 'Strep A Rapid Test Kit', catalogNumber: 'STR-RDT-100', lotNumber: 'LOT-STU901', manufacturer: 'Abbott', category: 'kit', quantityOnHand: 8, unit: 'test', reorderPoint: 10, expirationDate: dateOnly(-45), storageLocation: 'Point-of-Care Cabinet', status: 'low_stock', createdAt: daysAgo(30), updatedAt: daysAgo(0) },
    { id: uuid(), name: 'Urine Dipstick Strips', catalogNumber: 'URN-DIP-50', lotNumber: 'LOT-VWX234', manufacturer: 'Bayer', category: 'reagent', quantityOnHand: 150, unit: 'strip', reorderPoint: 100, expirationDate: dateOnly(-365), storageLocation: 'UA Lab Drawer', status: 'in_stock', createdAt: daysAgo(60), updatedAt: daysAgo(7) },
    { id: uuid(), name: 'CBC Lyse Reagent (Expired)', catalogNumber: 'SYS-LYS-002', lotNumber: 'LOT-OLD001', manufacturer: 'Sysmex', category: 'reagent', quantityOnHand: 5, unit: 'bottle', reorderPoint: 3, expirationDate: dateOnly(15), storageLocation: 'Hematology Supply Room', instrumentId: IDS.i1, status: 'expired', createdAt: daysAgo(200), updatedAt: daysAgo(0) },
    { id: uuid(), name: 'Glucose Enzyme Reagent', catalogNumber: 'ROC-GLU-500', lotNumber: 'LOT-ROC001', manufacturer: 'Roche', category: 'reagent', quantityOnHand: 10, unit: 'bottle', reorderPoint: 4, expirationDate: dateOnly(-90), storageLocation: 'Chemistry Lab 2', instrumentId: IDS.i6, status: 'in_stock', createdAt: daysAgo(30), updatedAt: daysAgo(5) },
    { id: uuid(), name: 'Lyme Disease Ab Calibrator', catalogNumber: 'SIE-LYME-C', lotNumber: 'LOT-LYM001', manufacturer: 'Siemens', category: 'calibrator', quantityOnHand: 1, unit: 'set', reorderPoint: 2, expirationDate: dateOnly(-20), storageLocation: 'Immunology Fridge', instrumentId: IDS.i5, status: 'on_order', createdAt: daysAgo(40), updatedAt: daysAgo(3) },
    { id: uuid(), name: 'Micro Collection Tubes (EDTA)', catalogNumber: 'BEC-EDT-500', lotNumber: 'LOT-EDT001', manufacturer: 'Becton Dickinson', category: 'consumable', quantityOnHand: 800, unit: 'tube', reorderPoint: 500, expirationDate: dateOnly(-730), storageLocation: 'Phlebotomy Supply', status: 'in_stock', createdAt: daysAgo(60), updatedAt: daysAgo(1) },
  ];

  // ---- INVOICES ----
  const invoices: Invoice[] = [
    { id: IDS.inv1, invoiceNumber: 'INV-2026-0001', orderId: IDS.o1, patientId: IDS.p1, totalAmount: 185, amountPaid: 185, status: 'paid', issueDate: dateOnly(11), dueDate: dateOnly(-19), createdAt: daysAgo(11), updatedAt: daysAgo(5) },
    { id: IDS.inv2, invoiceNumber: 'INV-2026-0002', orderId: IDS.o2, patientId: IDS.p2, totalAmount: 120, amountPaid: 120, status: 'paid', issueDate: dateOnly(9), dueDate: dateOnly(-21), createdAt: daysAgo(9), updatedAt: daysAgo(4) },
    { id: IDS.inv3, invoiceNumber: 'INV-2026-0003', orderId: IDS.o4, patientId: IDS.p4, totalAmount: 82, amountPaid: 0, status: 'sent', issueDate: dateOnly(6), dueDate: dateOnly(-24), createdAt: daysAgo(6), updatedAt: daysAgo(6) },
    { id: IDS.inv4, invoiceNumber: 'INV-2026-0004', orderId: IDS.o6, patientId: IDS.p6, totalAmount: 45, amountPaid: 45, status: 'paid', issueDate: dateOnly(5), dueDate: dateOnly(-25), createdAt: daysAgo(5), updatedAt: daysAgo(2) },
    { id: IDS.inv5, invoiceNumber: 'INV-2026-0005', orderId: IDS.o9, patientId: IDS.p1, totalAmount: 137, amountPaid: 100, status: 'partial', issueDate: dateOnly(13), dueDate: dateOnly(-17), createdAt: daysAgo(13), updatedAt: daysAgo(3) },
    { id: IDS.inv6, invoiceNumber: 'INV-2026-0006', orderId: IDS.o3, patientId: IDS.p3, totalAmount: 95, amountPaid: 0, status: 'draft', issueDate: dateOnly(3), dueDate: dateOnly(-27), createdAt: daysAgo(3), updatedAt: daysAgo(3) },
    { id: IDS.inv7, invoiceNumber: 'INV-2026-0007', orderId: IDS.o5, patientId: IDS.p5, totalAmount: 93, amountPaid: 0, status: 'draft', issueDate: dateOnly(1), dueDate: dateOnly(-29), createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { id: IDS.inv8, invoiceNumber: 'INV-2026-0008', orderId: IDS.o8, patientId: IDS.p8, totalAmount: 58, amountPaid: 0, status: 'sent', issueDate: dateOnly(2), dueDate: dateOnly(-28), createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { id: IDS.inv9, invoiceNumber: 'INV-2026-0009', orderId: IDS.o7, patientId: IDS.p7, totalAmount: 125, amountPaid: 0, status: 'draft', issueDate: dateOnly(0), dueDate: dateOnly(-30), createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { id: IDS.inv10, invoiceNumber: 'INV-2026-0010', orderId: IDS.o2, patientId: IDS.p2, totalAmount: 65, amountPaid: 0, status: 'overdue', issueDate: dateOnly(90), dueDate: dateOnly(60), createdAt: daysAgo(90), updatedAt: daysAgo(60) },
  ];

  // ---- INSURANCE CLAIMS ----
  const claims: InsuranceClaim[] = [
    { id: IDS.cl1, claimNumber: 'CLM-2026-0001', invoiceId: IDS.inv1, patientId: IDS.p1, insuranceProvider: 'BlueCross BlueShield', policyNumber: 'BCB-12345', claimAmount: 185, approvedAmount: 160, status: 'paid', submittedDate: dateOnly(10), resolvedDate: dateOnly(6), createdAt: daysAgo(10), updatedAt: daysAgo(6) },
    { id: IDS.cl2, claimNumber: 'CLM-2026-0002', invoiceId: IDS.inv2, patientId: IDS.p2, insuranceProvider: 'Medicare', policyNumber: 'MED-67890', claimAmount: 120, approvedAmount: 120, status: 'approved', submittedDate: dateOnly(8), createdAt: daysAgo(8), updatedAt: daysAgo(4) },
    { id: IDS.cl3, claimNumber: 'CLM-2026-0003', invoiceId: IDS.inv3, patientId: IDS.p4, insuranceProvider: 'United Health', policyNumber: 'UH-22222', claimAmount: 82, status: 'submitted', submittedDate: dateOnly(5), createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    { id: IDS.cl4, claimNumber: 'CLM-2026-0004', invoiceId: IDS.inv5, patientId: IDS.p1, insuranceProvider: 'BlueCross BlueShield', policyNumber: 'BCB-12345', claimAmount: 137, approvedAmount: 100, status: 'partially_approved', submittedDate: dateOnly(12), resolvedDate: dateOnly(5), createdAt: daysAgo(12), updatedAt: daysAgo(5) },
    { id: IDS.cl5, claimNumber: 'CLM-2026-0005', invoiceId: IDS.inv3, patientId: IDS.p4, insuranceProvider: 'United Health', claimAmount: 82, status: 'denied', submittedDate: dateOnly(15), resolvedDate: dateOnly(8), denialReason: 'Test not covered under current policy. Manual coding error.', createdAt: daysAgo(15), updatedAt: daysAgo(8) },
    { id: IDS.cl6, claimNumber: 'CLM-2026-0006', invoiceId: IDS.inv6, patientId: IDS.p3, insuranceProvider: 'Aetna', policyNumber: 'AET-11111', claimAmount: 95, status: 'draft', createdAt: daysAgo(3), updatedAt: daysAgo(3) },
  ];

  // ---- QC RUNS ----
  const qcRuns: QCRun[] = [];
  // Generate ~30 QC runs across the past 30 days
  const qcData = [
    { instId: IDS.i1, catId: IDS.c4, level: 'level_1' as const, mean: 13.5, sd: 0.2 },
    { instId: IDS.i1, catId: IDS.c4, level: 'level_2' as const, mean: 16.0, sd: 0.25 },
    { instId: IDS.i2, catId: IDS.c6, level: 'level_1' as const, mean: 85, sd: 2.5 },
    { instId: IDS.i2, catId: IDS.c6, level: 'level_2' as const, mean: 250, sd: 5 },
    { instId: IDS.i5, catId: IDS.c10, level: 'level_1' as const, mean: 1.2, sd: 0.1 },
  ];

  for (let day = 0; day < 30; day += 2) {
    for (const qc of qcData) {
      const jitter = (Math.random() * 2 - 1) * qc.sd * 1.5;
      const measured = parseFloat((qc.mean + jitter).toFixed(3));
      const zScore = Math.abs((measured - qc.mean) / qc.sd);
      const result: QCResult = zScore < 2 ? 'pass' : zScore < 3 ? 'warning' : 'fail';
      qcRuns.push({
        id: uuid(),
        instrumentId: qc.instId,
        testCatalogId: qc.catId,
        controlLevel: qc.level,
        measuredValue: measured,
        expectedMean: qc.mean,
        expectedSd: qc.sd,
        result,
        performedBy: IDS.s2,
        runDate: dateOnly(day),
        createdAt: daysAgo(day),
        updatedAt: daysAgo(day),
      });
    }
  }

  return {
    patients,
    providers,
    staff,
    testCatalog,
    orders,
    specimens,
    results,
    instruments,
    reagents,
    invoices,
    claims,
    qcRuns,
  };
}
