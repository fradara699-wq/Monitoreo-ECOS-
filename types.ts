
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export enum TherapyMode {
  CVVH = 'CVVH',
  CVVHD = 'CVVHD',
  CVVHDF = 'CVVHDF',
  SCUF = 'SCUF',
  SLED = 'SLED/PIRRT',
  MARS = 'MARS',
  TPE = 'TPE'
}

export enum AnticoagulationType {
  NONE = 'Ninguna',
  HEPARIN = 'Heparina Sistémica',
  CITRATE = 'Citrato Regional',
  LMWH = 'HBPM'
}

export enum AccessSite {
  JUGULAR_RIGHT = 'Yugular Der',
  JUGULAR_LEFT = 'Yugular Izq',
  FEMORAL_RIGHT = 'Femoral Der',
  FEMORAL_LEFT = 'Femoral Izq',
  SUBCLAVIAN_RIGHT = 'Subclavia Der',
  SUBCLAVIAN_LEFT = 'Subclavia Izq'
}

export enum FilterType {
  F14 = '1.4',
  F17 = '1.7',
  PEX = 'PEX',
  TP1000 = 'TP1000'
}

export enum ReplacementFluid {
  // Preparados Hospitalarios / Genéricos
  RIVERO_K25 = 'Rivero K2.5',
  RIVERO_K35 = 'Rivero K3.5',
  RIVERO_K45 = 'Rivero K4.5',
  SF_1000 = 'Solución fisiológica 1 Lt',
  SF_2000 = 'Solución fisiologica 2 Lt',
  SF_500 = 'Solución fisiológica 500 ml',
  AD_500 = 'Agua destilada 500 ml',

  // Baxter
  PRISMASOL_2 = 'Prismasol 2 mmol/L K (Baxter)',
  PRISMASOL_4 = 'Prismasol 4 mmol/L K (Baxter)',
  PRISMASOL_BGK2 = 'Prismasol BGK 2/0 (Baxter)',
  PRISMASOL_BGK4 = 'Prismasol BGK 4/0 (Baxter)',
  PRISMASOL_BGK425 = 'Prismasol BGK 4/2.5 (Baxter)',
  HEMOSOL_B0 = 'Hemosol B0 (Baxter)',
  PHOXILIUM = 'Phoxilium (Baxter)',
  REGIOCIT = 'Regiocit (Baxter)',
  BIPHOZYL = 'Biphozyl (Baxter)',

  // Fresenius
  CICA_K2 = 'Ci-Ca Dialysate K2 (Fresenius)',
  CICA_K4 = 'Ci-Ca Dialysate K4 (Fresenius)',
  MULTIBIC_K0 = 'MultiBic K0 (Fresenius)',
  MULTIBIC_K2 = 'MultiBic K2 (Fresenius)',
  MULTIBIC_K3 = 'MultiBic K3 (Fresenius)',
  MULTIBIC_K4 = 'MultiBic K4 (Fresenius)',

  // Medtronic / Otros
  ACCUSOL_35 = 'Accusol 35 (Medtronic)',
  ACCUSOL_35_K2 = 'Accusol 35 K2 (Medtronic)',
  ACCUSOL_35_K4 = 'Accusol 35 K4 (Medtronic)',

  // TPE specific
  ALBUMIN_3 = 'Albumina 3%',
  ALBUMIN_4 = 'Albumina 4%',
  ALBUMIN_5 = 'Albumina 5%',
  PFC = 'Plasma fresco congelado'
}

export enum ReplacementSite {
  PRE = 'Pre filtro',
  POST = 'Post filtro'
}

export enum TerminationReason {
  RECOVERY = 'Recuperación de función renal',
  INTERMITTENT = 'Continua con TSR intermitente',
  COMPLICATION = 'Complicación del tratamiento',
  DEATH = 'Fallecimiento'
}

export interface Prescription {
  mode: TherapyMode;
  startDate?: string;
  accessSite: AccessSite;
  
  // New Fields
  filterType?: FilterType;
  filterNumber?: string; // New field
  replacementFluid?: ReplacementFluid;
  replacementSite: ReplacementSite;
  
  // Dosing
  totalDose?: number; // ml/kg/h
  dialysatePercent?: number; // %
  replacementPercent?: number; // %
  
  // TPE Dosing
  hematocrit?: number; // Hto (%)
  plasmaVolumeToTreat?: number; // VPT (ml)

  // SLED Dosing
  sledTreatmentHours?: number; // hs

  // Flows
  bloodFlow: number; // QB (ml/min)
  dialysateFlow?: number; // QD (ml/hr) - Calculated
  replacementFlow?: number; // QRF (ml/hr) - Calculated
  prePostRatio?: string; // Pre/Post filter ratio (Legacy/Optional now)
  
  fluidRemovalGoal: number; // Renamed UI to Pérdida de peso (ml/hr or ml)
  
  anticoagulation: AnticoagulationType;
  citrateDose?: number; // ml/h (Calculated from Qb)
  calciumReturn?: number; // mmol/hr
  
  heparinBolus?: number;
  heparinDose?: number; // U/kg/h
  heparinRate?: number; // ml/h

  hemoadsorption?: boolean;
}

export interface MonitorEntry {
  id: string;
  timestamp: number;
  accessPressure: number;
  returnPressure: number;
  // filterPressure removed
  effluentPressure: number;
  tmp: number; // Label UI: PTM
  pressureDrop: number;
  filtrationFraction?: number; // UI: FF
  
  // Vital Signs
  tam?: number;
  sato2?: number;
  fc?: number;
  temp?: number;
  
  // Labs
  // ph removed
  bicarb?: number;
  // potassium removed
  ionizedCalciumSystemic?: number;
  ionizedCalciumCircuit?: number;
  
  complications?: string;
  nursingNotes?: string;
}

export interface BalanceEntry {
  id: string;
  timestamp: number;
  
  // Ingresos - Vasoactivos
  noradrenalina?: number;
  vasopresina?: number;
  dobutamina?: number;
  milrinona?: number;
  adrenalina?: number;
  otrosVaso?: number;

  // Ingresos - Sedación/Analgesia
  propofol?: number;
  midazolam?: number;
  dexmedetomidina?: number;
  otrosSedantes?: number;
  remifentanilo?: number;
  fentanilo?: number;
  otrosAnalgesicos?: number;
  bloqueanteNM?: number;

  // Ingresos - Otros
  insulina?: number;
  php?: number; // Cargas
  magnesio?: number;
  calcio?: number;
  fosforo?: number;
  antimicrobianos?: number;
  hemoderivados?: number;
  npt?: number; // Nutricion Parenteral
  net?: number; // Nutricion Enteral

  // Egresos
  ultrafiltration?: number; // Pérdida de peso (Machine)
  diuresis?: number;
  sng?: number;
  drenajes?: number;
  catarsis?: number;
  otrosEgresos?: number;

  // Totals
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
}

export interface PrescriptionHistoryEntry {
  timestamp: number;
  userId: string;
  userName: string;
  changes: string[]; // List of strings describing changes e.g. "QB: 150 -> 200"
}

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  dob: string;
  admissionDate: string;
  weight: number;
  diagnosis: string;
  accessDate: string;
  isActive: boolean;
  
  // Termination info
  endDate?: string;
  terminationReason?: TerminationReason;

  prescription: Prescription;
  prescriptionHistory: PrescriptionHistoryEntry[];
  
  monitoringLog: MonitorEntry[];
  balanceLog: BalanceEntry[];
}
