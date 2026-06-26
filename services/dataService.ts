import { Patient, User, UserRole, TherapyMode, AnticoagulationType, AccessSite, MonitorEntry, FilterType, ReplacementFluid, ReplacementSite, BalanceEntry } from '../types';

interface InternalUser extends User {
  password?: string;
}

// Mock Users
let MOCK_USERS: InternalUser[] = [
  { id: '1', username: 'admin', role: UserRole.ADMIN, name: 'Dr. Administrador', password: '1234' },
  { id: '2', username: 'user', role: UserRole.USER, name: 'Lic. Enfermería', password: '1234' },
  { id: '3', username: 'medico', role: UserRole.USER, name: 'Dr. Guardia', password: '1234' }
];

// Initial Mock Data
let PATIENTS_DB: Patient[] = [
  {
    id: 'p1',
    mrn: 'HC-123456',
    fullName: 'Juan Perez',
    dob: '1965-05-20',
    admissionDate: '2023-10-01',
    weight: 85,
    diagnosis: 'Shock Séptico / AKI KDIGO 3',
    accessDate: '2023-10-02',
    isActive: true,
    prescription: {
      mode: TherapyMode.CVVHDF,
      startDate: '2023-10-02T14:30',
      accessSite: AccessSite.JUGULAR_RIGHT,
      filterType: FilterType.F17,
      replacementFluid: ReplacementFluid.RIVERO_K25,
      replacementSite: ReplacementSite.POST,
      totalDose: 25,
      dialysatePercent: 50,
      replacementPercent: 50,
      bloodFlow: 150,
      dialysateFlow: 1062, // approx 25 * 85 * 0.5
      replacementFlow: 1062,
      prePostRatio: '50/50',
      fluidRemovalGoal: 100,
      anticoagulation: AnticoagulationType.CITRATE,
      citrateDose: 270, // 150 * 1.8
      // calciumReturn removed
      hemoadsorption: true
    },
    prescriptionHistory: [],
    monitoringLog: [
      {
        id: 'm1',
        timestamp: Date.now() - 3600000,
        accessPressure: -80,
        returnPressure: 60,
        effluentPressure: 20,
        tmp: 130,
        pressureDrop: 40,
        filtrationFraction: 22,
        ionizedCalciumSystemic: 1.12,
        ionizedCalciumCircuit: 0.35,
        nursingNotes: 'Inicio sin complicaciones.'
      }
    ],
    balanceLog: []
  },
  {
    id: 'p2',
    mrn: 'HC-999888',
    fullName: 'Maria Gonzalez',
    dob: '1980-02-15',
    admissionDate: '2023-09-20',
    weight: 60,
    diagnosis: 'Falla Hepática Fulminante',
    accessDate: '2023-09-25',
    isActive: false,
    prescription: {
      mode: TherapyMode.MARS,
      startDate: '2023-09-25T08:00',
      accessSite: AccessSite.FEMORAL_RIGHT,
      filterType: FilterType.F14,
      replacementFluid: ReplacementFluid.SF_1000,
      replacementSite: ReplacementSite.POST,
      totalDose: 20,
      dialysatePercent: 0,
      replacementPercent: 100,
      bloodFlow: 200,
      fluidRemovalGoal: 0,
      anticoagulation: AnticoagulationType.NONE,
      hemoadsorption: false
    },
    prescriptionHistory: [],
    monitoringLog: [],
    balanceLog: []
  }
];

export const AuthService = {
  login: (username: string, password: string): Promise<User | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = MOCK_USERS.find(u => u.username === username);
        if (user && user.password === password) {
          const { password, ...safeUser } = user;
          resolve(safeUser);
        } else {
          resolve(null);
        }
      }, 500);
    });
  },

  getUsers: (): Promise<User[]> => {
    return Promise.resolve(MOCK_USERS.map(({ password, ...u }) => u));
  },

  updateUser: (id: string, name: string, password?: string): Promise<void> => {
    const user = MOCK_USERS.find(u => u.id === id);
    if (user) {
      user.name = name;
      if (password && password.trim() !== '') {
        user.password = password;
      }
    }
    return Promise.resolve();
  },

  updateUserRole: (id: string, role: UserRole): Promise<void> => {
    const user = MOCK_USERS.find(u => u.id === id);
    if (user) {
      user.role = role;
    }
    return Promise.resolve();
  }
};

export const DataService = {
  getPatients: (): Promise<Patient[]> => {
    return Promise.resolve([...PATIENTS_DB]);
  },
  
  getActivePatients: (): Promise<Patient[]> => {
    return Promise.resolve(PATIENTS_DB.filter(p => p.isActive));
  },

  getPatientById: (id: string): Promise<Patient | undefined> => {
    return Promise.resolve(PATIENTS_DB.find(p => p.id === id));
  },

  savePatient: (patient: Patient): Promise<void> => {
    const index = PATIENTS_DB.findIndex(p => p.id === patient.id);
    if (index >= 0) {
      PATIENTS_DB[index] = patient;
    } else {
      PATIENTS_DB.push(patient);
    }
    return Promise.resolve();
  },

  addMonitorEntry: (patientId: string, entry: MonitorEntry): Promise<void> => {
    const patient = PATIENTS_DB.find(p => p.id === patientId);
    if (patient) {
      if (!patient.monitoringLog) patient.monitoringLog = [];
      patient.monitoringLog.unshift(entry); // Add to top
    }
    return Promise.resolve();
  },

  addBalanceEntry: (patientId: string, entry: BalanceEntry): Promise<void> => {
    const patient = PATIENTS_DB.find(p => p.id === patientId);
    if (patient) {
      if (!patient.balanceLog) patient.balanceLog = [];
      patient.balanceLog.unshift(entry);
    }
    return Promise.resolve();
  }
};