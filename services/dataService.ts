import { Patient, User, UserRole, TherapyMode, AnticoagulationType, AccessSite, MonitorEntry, FilterType, ReplacementFluid, ReplacementSite, BalanceEntry } from '../types';

// Local Users Database State
const DEFAULT_USERS: (User & { password?: string })[] = [
  { id: 'u1', username: 'admin', role: UserRole.ADMIN, name: 'Dr. Administrador', password: '1234' },
  { id: 'u2', username: 'user', role: UserRole.USER, name: 'Lic. Enfermería', password: '1234' },
  { id: 'u3', username: 'medico', role: UserRole.USER, name: 'Dr. Guardia', password: '1234' }
];

// Initial Mock Patients
const MOCK_PATIENTS: Patient[] = [
  {
    id: 'p1',
    mrn: '123456',
    fullName: 'Juan Pérez',
    dob: '1980-05-15',
    admissionDate: '2026-06-25',
    weight: 75,
    diagnosis: 'Insuficiencia Renal Aguda, Shock Séptico',
    accessDate: '2026-06-25',
    isActive: true,
    prescription: {
      mode: TherapyMode.CVVHDF,
      accessSite: AccessSite.JUGULAR_RIGHT,
      replacementSite: ReplacementSite.POST,
      bloodFlow: 150,
      fluidRemovalGoal: 100,
      anticoagulation: AnticoagulationType.NONE,
    },
    prescriptionHistory: [],
    monitoringLog: [
      {
        id: 'm1',
        timestamp: Date.now() - 3600000 * 2,
        accessPressure: -80,
        returnPressure: 120,
        effluentPressure: 50,
        tmp: 70,
        pressureDrop: 40,
        filtrationFraction: 18,
        tam: 75,
        sato2: 96,
        fc: 85,
        temp: 37.2,
        bicarb: 22,
        ionizedCalciumSystemic: 1.15,
        ionizedCalciumCircuit: 0.35,
        nursingNotes: 'Terapia funcionando estable sin alarmas.'
      }
    ],
    balanceLog: [
      {
        id: 'b1',
        timestamp: Date.now() - 3600000 * 2,
        noradrenalina: 0.1,
        propofol: 15,
        fentanilo: 50,
        ultrafiltration: 150,
        diuresis: 20,
        totalIngresos: 80,
        totalEgresos: 170,
        balance: -90
      }
    ]
  },
  {
    id: 'p2',
    mrn: '789012',
    fullName: 'María Rodríguez',
    dob: '1965-11-20',
    admissionDate: '2026-06-24',
    weight: 62,
    diagnosis: 'Sobrecarga de volumen refractaria',
    accessDate: '2026-06-24',
    isActive: true,
    prescription: {
      mode: TherapyMode.CVVHD,
      accessSite: AccessSite.FEMORAL_RIGHT,
      replacementSite: ReplacementSite.POST,
      bloodFlow: 120,
      fluidRemovalGoal: 200,
      anticoagulation: AnticoagulationType.HEPARIN,
      heparinBolus: 1000,
      heparinDose: 10,
      heparinRate: 1.5
    },
    prescriptionHistory: [],
    monitoringLog: [],
    balanceLog: []
  }
];

function getLocalUsers(): (User & { password?: string })[] {
  const stored = localStorage.getItem('ecos_local_users');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // ignore
    }
  }
  return DEFAULT_USERS;
}

function saveLocalUsers(users: (User & { password?: string })[]) {
  localStorage.setItem('ecos_local_users', JSON.stringify(users));
}

function getLocalPatients(): Patient[] {
  const stored = localStorage.getItem('ecos_local_patients');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // ignore
    }
  }
  // Seed initial mock patients if empty
  saveLocalPatients(MOCK_PATIENTS);
  return MOCK_PATIENTS;
}

function saveLocalPatients(patients: Patient[]) {
  localStorage.setItem('ecos_local_patients', JSON.stringify(patients));
}

export const AuthService = {
  login: async (username: string, password?: string): Promise<User | null> => {
    // Delay slightly to simulate real authentication latency
    await new Promise(resolve => setTimeout(resolve, 300));
    const users = getLocalUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user && user.password === password) {
      const { password: _, ...safeUser } = user;
      return safeUser;
    }
    return null;
  },

  getUsers: async (): Promise<User[]> => {
    const users = getLocalUsers();
    return users.map((u: any) => {
      const { password: _, ...safeUser } = u;
      return safeUser;
    });
  },

  updateUser: async (id: string, name: string, password?: string): Promise<void> => {
    const users = getLocalUsers();
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      users[userIndex].name = name;
      if (password && password.trim() !== '') {
        users[userIndex].password = password;
      }
      saveLocalUsers(users);
    }
  },

  updateUserRole: async (id: string, role: UserRole): Promise<void> => {
    const users = getLocalUsers();
    const userIndex = users.findIndex(u => u.id === id);
    if (userIndex !== -1) {
      users[userIndex].role = role;
      saveLocalUsers(users);
    }
  }
};

export const DataService = {
  getPatients: async (): Promise<Patient[]> => {
    // Return sorted patients with active ones first, then alphabetical by name
    const patients = getLocalPatients();
    return patients.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  },
  
  getActivePatients: async (): Promise<Patient[]> => {
    const patients = getLocalPatients();
    return patients.filter(p => p.isActive);
  },

  getPatientById: async (id: string): Promise<Patient | undefined> => {
    const patients = getLocalPatients();
    return patients.find(p => p.id === id);
  },

  savePatient: async (patient: Patient): Promise<void> => {
    const patients = getLocalPatients();
    const index = patients.findIndex(p => p.id === patient.id);
    if (index !== -1) {
      patients[index] = patient;
    } else {
      patients.push(patient);
    }
    saveLocalPatients(patients);
  },

  addMonitorEntry: async (patientId: string, entry: MonitorEntry): Promise<void> => {
    const patients = getLocalPatients();
    const patientIndex = patients.findIndex(p => p.id === patientId);
    if (patientIndex !== -1) {
      if (!patients[patientIndex].monitoringLog) {
        patients[patientIndex].monitoringLog = [];
      }
      patients[patientIndex].monitoringLog.unshift(entry);
      saveLocalPatients(patients);
    } else {
      throw new Error(`Paciente no encontrado con ID ${patientId}`);
    }
  },

  addBalanceEntry: async (patientId: string, entry: BalanceEntry): Promise<void> => {
    const patients = getLocalPatients();
    const patientIndex = patients.findIndex(p => p.id === patientId);
    if (patientIndex !== -1) {
      if (!patients[patientIndex].balanceLog) {
        patients[patientIndex].balanceLog = [];
      }
      patients[patientIndex].balanceLog.unshift(entry);
      saveLocalPatients(patients);
    } else {
      throw new Error(`Paciente no encontrado con ID ${patientId}`);
    }
  }
};
