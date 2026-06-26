import { Patient, User, UserRole, TherapyMode, AnticoagulationType, AccessSite, MonitorEntry, FilterType, ReplacementFluid, ReplacementSite, BalanceEntry } from '../types';

// Local Users Database State
const DEFAULT_USERS: (User & { password?: string })[] = [
  { id: 'u1', username: 'admin', role: UserRole.ADMIN, name: 'Dr. Administrador', password: '1234' },
  { id: 'u2', username: 'user', role: UserRole.USER, name: 'Lic. Enfermería', password: '1234' },
  { id: 'u3', username: 'medico', role: UserRole.USER, name: 'Dr. Guardia', password: '1234' }
];

function getLocalUsers(): (User & { password?: string })[] {
  const stored = localStorage.getItem('hpu_local_users');
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
  localStorage.setItem('hpu_local_users', JSON.stringify(users));
}

// Helper to communicate with our Netlify function proxy (clinical records only)
async function fetchAirtable(method: string, id?: string, data?: any) {
  let url = `/.netlify/functions/airtable`;
  if (id && (method === 'GET' || method === 'DELETE')) {
    url += `?id=${id}`;
  }

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (method !== 'GET' && method !== 'DELETE') {
    options.body = JSON.stringify({ id, data });
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error al comunicarse con Airtable (HTTP ${response.status})`);
  }

  return response.json();
}

// Map Airtable records to Patient object
function mapAirtableRecordToPatient(record: any): Patient {
  const fields = record.fields || {};
  
  let prescription = {
    mode: TherapyMode.CVVHDF,
    accessSite: AccessSite.JUGULAR_RIGHT,
    replacementSite: ReplacementSite.POST,
    bloodFlow: 150,
    fluidRemovalGoal: 100,
    anticoagulation: AnticoagulationType.NONE,
  };

  if (typeof fields.prescription === 'string') {
    try {
      prescription = JSON.parse(fields.prescription);
    } catch (e) {
      console.error('Error parsing prescription JSON from Airtable:', e);
    }
  } else if (fields.prescription && typeof fields.prescription === 'object') {
    prescription = fields.prescription;
  }
  
  let prescriptionHistory = [];
  if (typeof fields.prescriptionHistory === 'string') {
    try {
      prescriptionHistory = JSON.parse(fields.prescriptionHistory);
    } catch (e) {
      console.error('Error parsing prescriptionHistory JSON from Airtable:', e);
    }
  } else if (Array.isArray(fields.prescriptionHistory)) {
    prescriptionHistory = fields.prescriptionHistory;
  }

  let monitoringLog = [];
  if (typeof fields.monitoringLog === 'string') {
    try {
      monitoringLog = JSON.parse(fields.monitoringLog);
    } catch (e) {
      console.error('Error parsing monitoringLog JSON from Airtable:', e);
    }
  } else if (Array.isArray(fields.monitoringLog)) {
    monitoringLog = fields.monitoringLog;
  }

  let balanceLog = [];
  if (typeof fields.balanceLog === 'string') {
    try {
      balanceLog = JSON.parse(fields.balanceLog);
    } catch (e) {
      console.error('Error parsing balanceLog JSON from Airtable:', e);
    }
  } else if (Array.isArray(fields.balanceLog)) {
    balanceLog = fields.balanceLog;
  }

  return {
    id: fields.id || record.id,
    mrn: fields.mrn || '',
    fullName: fields.fullName || '',
    dob: fields.dob || '',
    admissionDate: fields.admissionDate || '',
    weight: Number(fields.weight) || 0,
    diagnosis: fields.diagnosis || '',
    accessDate: fields.accessDate || '',
    isActive: fields.isActive === undefined ? true : !!fields.isActive,
    endDate: fields.endDate || undefined,
    terminationReason: fields.terminationReason || undefined,
    prescription: prescription as any,
    prescriptionHistory: prescriptionHistory,
    monitoringLog: monitoringLog,
    balanceLog: balanceLog,
  };
}

// Map Patient to fields format for Airtable
function mapPatientToAirtableFields(patient: Patient) {
  return {
    id: patient.id,
    mrn: patient.mrn,
    fullName: patient.fullName,
    dob: patient.dob,
    admissionDate: patient.admissionDate,
    weight: Number(patient.weight) || 0,
    diagnosis: patient.diagnosis,
    accessDate: patient.accessDate,
    isActive: !!patient.isActive,
    endDate: patient.endDate || '',
    terminationReason: patient.terminationReason || '',
    prescription: JSON.stringify(patient.prescription || {}),
    prescriptionHistory: JSON.stringify(patient.prescriptionHistory || []),
    monitoringLog: JSON.stringify(patient.monitoringLog || []),
    balanceLog: JSON.stringify(patient.balanceLog || [])
  };
}

export const AuthService = {
  login: async (username: string, password?: string): Promise<User | null> => {
    try {
      const users = getLocalUsers();
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (user && user.password === password) {
        const { password: _, ...safeUser } = user;
        return safeUser;
      }
      return null;
    } catch (error) {
      console.error('Error in AuthService.login:', error);
      throw error;
    }
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const users = getLocalUsers();
      return users.map((u: any) => {
        const { password: _, ...safeUser } = u;
        return safeUser;
      });
    } catch (error) {
      console.error('Error in AuthService.getUsers:', error);
      throw error;
    }
  },

  updateUser: async (id: string, name: string, password?: string): Promise<void> => {
    try {
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex !== -1) {
        users[userIndex].name = name;
        if (password && password.trim() !== '') {
          users[userIndex].password = password;
        }
        saveLocalUsers(users);
      }
    } catch (error) {
      console.error('Error in AuthService.updateUser:', error);
      throw error;
    }
  },

  updateUserRole: async (id: string, role: UserRole): Promise<void> => {
    try {
      const users = getLocalUsers();
      const userIndex = users.findIndex(u => u.id === id);
      if (userIndex !== -1) {
        users[userIndex].role = role;
        saveLocalUsers(users);
      }
    } catch (error) {
      console.error('Error in AuthService.updateUserRole:', error);
      throw error;
    }
  }
};

export const DataService = {
  getPatients: async (): Promise<Patient[]> => {
    try {
      const records = await fetchAirtable('GET');
      return records.map(mapAirtableRecordToPatient);
    } catch (error) {
      console.error('Error in DataService.getPatients:', error);
      throw error;
    }
  },
  
  getActivePatients: async (): Promise<Patient[]> => {
    try {
      const patients = await DataService.getPatients();
      return patients.filter(p => p.isActive);
    } catch (error) {
      console.error('Error in DataService.getActivePatients:', error);
      throw error;
    }
  },

  getPatientById: async (id: string): Promise<Patient | undefined> => {
    try {
      const patients = await DataService.getPatients();
      return patients.find(p => p.id === id);
    } catch (error) {
      console.error('Error in DataService.getPatientById:', error);
      throw error;
    }
  },

  savePatient: async (patient: Patient): Promise<void> => {
    try {
      const fields = mapPatientToAirtableFields(patient);
      await fetchAirtable('POST', patient.id, fields);
    } catch (error) {
      console.error('Error in DataService.savePatient:', error);
      throw error;
    }
  },

  addMonitorEntry: async (patientId: string, entry: MonitorEntry): Promise<void> => {
    try {
      const patient = await DataService.getPatientById(patientId);
      if (patient) {
        if (!patient.monitoringLog) patient.monitoringLog = [];
        patient.monitoringLog.unshift(entry);
        await DataService.savePatient(patient);
      } else {
        throw new Error(`Paciente no encontrado con ID ${patientId}`);
      }
    } catch (error) {
      console.error('Error in DataService.addMonitorEntry:', error);
      throw error;
    }
  },

  addBalanceEntry: async (patientId: string, entry: BalanceEntry): Promise<void> => {
    try {
      const patient = await DataService.getPatientById(patientId);
      if (patient) {
        if (!patient.balanceLog) patient.balanceLog = [];
        patient.balanceLog.unshift(entry);
        await DataService.savePatient(patient);
      } else {
        throw new Error(`Paciente no encontrado con ID ${patientId}`);
      }
    } catch (error) {
      console.error('Error in DataService.addBalanceEntry:', error);
      throw error;
    }
  }
};
