
import React, { useState, useEffect } from 'react';
import { Patient, User, UserRole, TherapyMode, AnticoagulationType, AccessSite, MonitorEntry, FilterType, ReplacementFluid, ReplacementSite, BalanceEntry, PrescriptionHistoryEntry, Prescription, TerminationReason } from '../types';
import { Save, AlertTriangle, Activity, User as UserIcon, FileText, ClipboardList, RefreshCw, Droplets, Loader2, Heart, Calendar, Clock, History, Calculator, CheckCircle, X } from 'lucide-react';
import { DataService } from '../services/dataService';
import Summary from './Summary';

interface PatientFormProps {
  user: User;
  patient?: Patient;
  onBack: () => void;
}

const emptyPatient: Patient = {
  id: '',
  mrn: '',
  fullName: '',
  dob: '',
  admissionDate: '',
  weight: 0,
  diagnosis: '',
  accessDate: '',
  isActive: true,
  prescription: {
    mode: TherapyMode.CVVHDF,
    startDate: '',
    accessSite: AccessSite.JUGULAR_RIGHT,
    filterType: FilterType.F17,
    filterNumber: '',
    replacementFluid: ReplacementFluid.RIVERO_K25,
    replacementSite: ReplacementSite.POST, // Default Post filtro
    totalDose: 25,
    dialysatePercent: 50,
    replacementPercent: 50,
    bloodFlow: 150,
    dialysateFlow: 0,
    replacementFlow: 0,
    fluidRemovalGoal: 0,
    anticoagulation: AnticoagulationType.NONE,
    hemoadsorption: false,
    hematocrit: 0,
    plasmaVolumeToTreat: 0,
    sledTreatmentHours: 0
  },
  prescriptionHistory: [],
  monitoringLog: [],
  balanceLog: []
};

// Helper to get current date string YYYY-MM-DD
const getCurrentDateStr = () => new Date().toISOString().split('T')[0];
// Helper to get current time string HH:mm
const getCurrentTimeStr = () => new Date().toTimeString().slice(0, 5);

const PatientForm: React.FC<PatientFormProps> = ({ user, patient, onBack }) => {
  const [activeTab, setActiveTab] = useState(patient ? 3 : 1); // Start on monitoring if existing, else general
  const [formData, setFormData] = useState<Patient>(patient ? JSON.parse(JSON.stringify(patient)) : { ...emptyPatient, id: Date.now().toString() });
  const [monitorForm, setMonitorForm] = useState<Partial<MonitorEntry>>({});
  const [balanceForm, setBalanceForm] = useState<Partial<BalanceEntry>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Date/Time State for Monitor
  const [monitorDate, setMonitorDate] = useState(getCurrentDateStr());
  const [monitorTime, setMonitorTime] = useState(getCurrentTimeStr());

  // Date/Time State for Balance
  const [balanceDate, setBalanceDate] = useState(getCurrentDateStr());
  const [balanceTime, setBalanceTime] = useState(getCurrentTimeStr());

  const isAdmin = user.role === UserRole.ADMIN;

  // Formula: Available = (TotalDose * Weight) - FluidRemoval
  // QD = Available * (DialysatePercent / 100)
  // QRF = Available * (ReplacementPercent / 100)
  const calculateFlows = (p: Prescription, weight: number): { qd: number, qrf: number } => {
     if (!weight || !p.totalDose) return { qd: 0, qrf: 0 };
     
     const totalVolume = p.totalDose * weight;
     const availableVolume = totalVolume - (p.fluidRemovalGoal || 0);
     
     // Prevent negative flows if removal is larger than total dose (edge case)
     const validAvailable = Math.max(0, availableVolume);

     const qd = Math.round(validAvailable * ((p.dialysatePercent || 0) / 100));
     const qrf = Math.round(validAvailable * ((p.replacementPercent || 0) / 100));
     
     return { qd, qrf };
  };

  // TPE Formula: VPT = (kg x 70 ml) x (1 - (Hto(%) / 100))
  const calculateVPT = (weight: number, hto: number): number => {
    if (!weight || hto === undefined) return 0;
    const vpt = (weight * 70) * (1 - (hto / 100));
    return Math.round(vpt);
  };

  const handleInputChange = (field: keyof Patient, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // If weight changes, we need to recalculate flows or VPT
      if (field === 'weight') {
        const weight = Number(value);
        const p = prev.prescription;
        
        if (p.mode === TherapyMode.TPE) {
          newData.prescription = {
            ...p,
            plasmaVolumeToTreat: calculateVPT(weight, p.hematocrit || 0)
          };
        } else if (p.mode !== TherapyMode.SLED) {
          const { qd, qrf } = calculateFlows(p, weight);
          newData.prescription = {
               ...p,
               dialysateFlow: qd,
               replacementFlow: qrf
          };
        }

        // Recalculate Heparin Rate if applicable
        if (p.heparinDose && p.anticoagulation === AnticoagulationType.HEPARIN && weight > 0) {
           const rate = (p.heparinDose * weight) / 500;
           newData.prescription = {
             ...newData.prescription,
             heparinRate: parseFloat(rate.toFixed(1))
           };
        }
      }
      return newData;
    });
  };

  const handlePrescriptionChange = (field: string, value: any) => {
    setFormData(prev => {
      const newPrescription = { ...prev.prescription, [field]: value };
      const weight = prev.weight;
      
      // Calculate Flows automatically when relevant fields change (not for SLED/TPE)
      if (['totalDose', 'dialysatePercent', 'replacementPercent', 'fluidRemovalGoal'].includes(field)) {
        if (weight > 0 && newPrescription.mode !== TherapyMode.TPE && newPrescription.mode !== TherapyMode.SLED) {
          const { qd, qrf } = calculateFlows(newPrescription, weight);
          newPrescription.dialysateFlow = qd;
          newPrescription.replacementFlow = qrf;
        }
      }

      // TPE Specific: Recalculate VPT
      if (field === 'hematocrit') {
        newPrescription.plasmaVolumeToTreat = calculateVPT(weight, Number(value));
      }

      // Reset fields if mode changes
      if (field === 'mode') {
        if (value === TherapyMode.TPE) {
          newPrescription.dialysateFlow = 0;
          newPrescription.replacementFlow = 0;
          newPrescription.plasmaVolumeToTreat = calculateVPT(weight, newPrescription.hematocrit || 0);
          newPrescription.filterType = FilterType.PEX; // Default to PEX for TPE
        } else if (value === TherapyMode.SLED) {
          newPrescription.dialysateFlow = newPrescription.dialysateFlow || 0;
          newPrescription.replacementFlow = 0;
          newPrescription.replacementFluid = undefined;
          newPrescription.replacementSite = ReplacementSite.POST;
        } else {
          const { qd, qrf } = calculateFlows(newPrescription, weight);
          newPrescription.dialysateFlow = qd;
          newPrescription.replacementFlow = qrf;
        }
      }

      // Calculate Citrate Dose automatically when Blood Flow changes (Qb * 0.03 * 60 = Qb * 1.8)
      if (field === 'bloodFlow') {
        newPrescription.citrateDose = Math.round(Number(value) * 1.8);
      }

      // Initialize Citrate Dose if switching to Citrate
      if (field === 'anticoagulation' && value === AnticoagulationType.CITRATE) {
        newPrescription.citrateDose = Math.round((newPrescription.bloodFlow || 0) * 1.8);
      }

      // Calculate Heparin Rate automatically when Heparin Dose changes
      if (field === 'heparinDose') {
        const dose = Number(value);
        if (weight > 0) {
           const rate = (dose * weight) / 500;
           newPrescription.heparinRate = parseFloat(rate.toFixed(1));
        }
      }

      return {
        ...prev,
        prescription: newPrescription
      };
    });
  };

  const handleMonitorChange = (field: string, value: any) => {
    setMonitorForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBalanceChange = (field: string, value: any) => {
    setBalanceForm(prev => {
      const numValue = value === '' ? undefined : Number(value);
      return { ...prev, [field]: numValue };
    });
  };

  // Fixed the incorrect name reference in calculation
  const calculateBalanceTotals = () => {
    const b = balanceForm;
    const inputs = [
      b.noradrenalina, b.vasopresina, b.dobutamina, b.milrinona, b.adrenalina, b.otrosVaso,
      b.propofol, b.midazolam, b.dexmedetomidina, b.otrosSedantes, b.remifentanilo, b.fentanilo, b.otrosAnalgesicos, b.bloqueanteNM,
      b.insulina, b.php, b.magnesio, b.calcio, b.fosforo, b.antimicrobianos, b.hemoderivados, b.npt, b.net
    ];
    const outputs = [
      b.ultrafiltration, b.diuresis, b.sng, b.drenajes, b.catarsis, b.otrosEgresos
    ];

    const totalIngresos = inputs.reduce((acc, curr) => acc + (curr || 0), 0);
    const totalEgresos = outputs.reduce((acc, curr) => acc + (curr || 0), 0);
    const balance = totalIngresos - totalEgresos;

    return { totalIngresos, totalEgresos, balance };
  };

  const getBalanceStats = () => {
    const log = formData.balanceLog || [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const accumulated = log.reduce((acc, curr) => acc + curr.balance, 0);
    const todayLogs = log.filter(l => l.timestamp >= startOfDay);
    const total24h = todayLogs.reduce((acc, curr) => ({
      ingresos: acc.ingresos + curr.totalIngresos,
      egresos: acc.egresos + curr.totalEgresos,
      balance: acc.balance + curr.balance
    }), { ingresos: 0, egresos: 0, balance: 0 });

    const blocks = {
      '00-06': { ing: 0, egr: 0, bal: 0 },
      '06-12': { ing: 0, egr: 0, bal: 0 },
      '12-18': { ing: 0, egr: 0, bal: 0 },
      '18-24': { ing: 0, egr: 0, bal: 0 }
    };

    todayLogs.forEach(entry => {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      let key: keyof typeof blocks | null = null;
      if (hour >= 0 && hour < 6) key = '00-06';
      else if (hour >= 6 && hour < 12) key = '06-12';
      else if (hour >= 12 && hour < 18) key = '12-18';
      else if (hour >= 18 && hour <= 23) key = '18-24';
      if (key) {
        blocks[key].ing += entry.totalIngresos;
        blocks[key].egr += entry.totalEgresos;
        blocks[key].bal += entry.balance;
      }
    });

    return { accumulated, total24h, blocks };
  };

  const calculateAge = (dob: string) => {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  const detectPrescriptionChanges = (oldP: Prescription, newP: Prescription): string[] => {
    const changes: string[] = [];
    const fmt = (v: any) => v === undefined || v === null || v === '' ? '-' : v.toString();

    if (oldP.mode !== newP.mode) changes.push(`Modalidad: ${fmt(oldP.mode)} -> ${fmt(newP.mode)}`);
    if (oldP.accessSite !== newP.accessSite) changes.push(`Sitio Acceso: ${fmt(oldP.accessSite)} -> ${fmt(newP.accessSite)}`);
    if (oldP.filterType !== newP.filterType) changes.push(`Filtro: ${fmt(oldP.filterType)} -> ${fmt(newP.filterType)}`);
    if (oldP.filterNumber !== newP.filterNumber) changes.push(`N° Filtro: ${fmt(oldP.filterNumber)} -> ${fmt(newP.filterNumber)}`);
    if (oldP.replacementFluid !== newP.replacementFluid) changes.push(`Liq. Reposición: ${fmt(oldP.replacementFluid)} -> ${fmt(newP.replacementFluid)}`);
    if (oldP.replacementSite !== newP.replacementSite) changes.push(`Sitio Reposición: ${fmt(oldP.replacementSite)} -> ${fmt(newP.replacementSite)}`);
    
    if (newP.mode === TherapyMode.TPE) {
      if (oldP.hematocrit !== newP.hematocrit) changes.push(`Hto: ${fmt(oldP.hematocrit)}% -> ${fmt(newP.hematocrit)}%`);
      if (oldP.plasmaVolumeToTreat !== newP.plasmaVolumeToTreat) changes.push(`VPT: ${fmt(oldP.plasmaVolumeToTreat)}ml -> ${fmt(newP.plasmaVolumeToTreat)}ml`);
    } else if (newP.mode === TherapyMode.SLED) {
      if (oldP.sledTreatmentHours !== newP.sledTreatmentHours) changes.push(`Horas Tratamiento: ${fmt(oldP.sledTreatmentHours)} -> ${fmt(newP.sledTreatmentHours)}`);
    } else {
      if (oldP.totalDose !== newP.totalDose) changes.push(`Dosis Total: ${fmt(oldP.totalDose)} -> ${fmt(newP.totalDose)}`);
      if (oldP.dialysatePercent !== newP.dialysatePercent) changes.push(`% Dializado: ${fmt(oldP.dialysatePercent)}% -> ${fmt(newP.dialysatePercent)}%`);
      if (oldP.replacementPercent !== newP.replacementPercent) changes.push(`% Reposición: ${fmt(oldP.replacementPercent)}% -> ${fmt(newP.replacementPercent)}%`);
    }
    
    if (oldP.bloodFlow !== newP.bloodFlow) changes.push(`QB (Sangre): ${fmt(oldP.bloodFlow)} -> ${fmt(newP.bloodFlow)}`);
    if (oldP.dialysateFlow !== newP.dialysateFlow) changes.push(`QD (Dializado): ${fmt(oldP.dialysateFlow)} -> ${fmt(newP.dialysateFlow)}`);
    if (oldP.replacementFlow !== newP.replacementFlow) changes.push(`QRF (Reposición): ${fmt(oldP.replacementFlow)} -> ${fmt(newP.replacementFlow)}`);
    if (oldP.fluidRemovalGoal !== newP.fluidRemovalGoal) changes.push(`Pérdida Peso: ${fmt(oldP.fluidRemovalGoal)} -> ${fmt(newP.fluidRemovalGoal)}`);
    if (oldP.anticoagulation !== newP.anticoagulation) changes.push(`Anticoagulación: ${fmt(oldP.anticoagulation)} -> ${fmt(newP.anticoagulation)}`);
    if (oldP.hemoadsorption !== newP.hemoadsorption) changes.push(`Hemoadsorción: ${oldP.hemoadsorption ? 'Sí' : 'No'} -> ${newP.hemoadsorption ? 'Sí' : 'No'}`);

    return changes;
  };

  const savePatient = async () => {
    setIsSubmitting(true);
    let updatedFormData = { ...formData };
    
    if (patient) {
      const changes = detectPrescriptionChanges(patient.prescription, formData.prescription);
      if (changes.length > 0) {
        const historyEntry: PrescriptionHistoryEntry = {
          timestamp: Date.now(),
          userId: user.id,
          userName: user.name,
          changes: changes
        };
        updatedFormData.prescriptionHistory = [historyEntry, ...(formData.prescriptionHistory || [])];
      }
    }
    
    try {
      await DataService.savePatient(updatedFormData);
      setFormData(updatedFormData);
      setIsSubmitting(false);
      setShowConfirmDialog(false);
      alert('Datos guardados correctamente');
      if (!patient) onBack();
    } catch (error: any) {
      setIsSubmitting(false);
      console.error(error);
      alert('Error al guardar datos en Airtable: ' + (error.message || error));
    }
  };

  const addMonitorEntry = async () => {
    if (!monitorForm.accessPressure || !monitorForm.returnPressure) {
      alert('Complete al menos las presiones básicas');
      return;
    }
    setIsSubmitting(true);
    const dateTimeString = `${monitorDate}T${monitorTime}`;
    const timestamp = new Date(dateTimeString).getTime();
    const newEntry: MonitorEntry = {
      id: Date.now().toString(),
      timestamp: timestamp,
      accessPressure: Number(monitorForm.accessPressure),
      returnPressure: Number(monitorForm.returnPressure),
      effluentPressure: Number(monitorForm.effluentPressure || 0),
      tmp: Number(monitorForm.tmp || 0),
      pressureDrop: Number(monitorForm.pressureDrop || 0),
      filtrationFraction: Number(monitorForm.filtrationFraction || 0),
      tam: monitorForm.tam ? Number(monitorForm.tam) : undefined,
      sato2: monitorForm.sato2 ? Number(monitorForm.sato2) : undefined,
      fc: monitorForm.fc ? Number(monitorForm.fc) : undefined,
      temp: monitorForm.temp ? Number(monitorForm.temp) : undefined,
      bicarb: Number(monitorForm.bicarb),
      ionizedCalciumCircuit: Number(monitorForm.ionizedCalciumCircuit),
      ionizedCalciumSystemic: Number(monitorForm.ionizedCalciumSystemic),
      complications: monitorForm.complications,
      nursingNotes: monitorForm.nursingNotes
    };
    try {
      await DataService.addMonitorEntry(formData.id, newEntry);
      setFormData(prev => {
        const exists = prev.monitoringLog.some(e => e.id === newEntry.id);
        const newLog = exists ? [...prev.monitoringLog] : [newEntry, ...(prev.monitoringLog || [])];
        return {
          ...prev,
          monitoringLog: newLog.sort((a, b) => b.timestamp - a.timestamp)
        };
      });
      setMonitorForm({}); 
      setMonitorTime(getCurrentTimeStr());
      setIsSubmitting(false);
    } catch (error: any) {
      setIsSubmitting(false);
      console.error(error);
      alert('Error al agregar monitoreo en Airtable: ' + (error.message || error));
    }
  };

  const addBalanceEntry = async () => {
    const { totalIngresos, totalEgresos, balance } = calculateBalanceTotals();
    if (totalIngresos === 0 && totalEgresos === 0) {
      alert('Ingrese al menos un valor de ingreso o egreso');
      return;
    }
    setIsSubmitting(true);
    const dateTimeString = `${balanceDate}T${balanceTime}`;
    const timestamp = new Date(dateTimeString).getTime();
    const newEntry: BalanceEntry = {
      id: Date.now().toString(),
      timestamp: timestamp,
      ...balanceForm,
      totalIngresos,
      totalEgresos,
      balance
    };
    try {
      await DataService.addBalanceEntry(formData.id, newEntry);
      setFormData(prev => {
        const exists = (prev.balanceLog || []).some(e => e.id === newEntry.id);
        const newLog = exists ? [...(prev.balanceLog || [])] : [newEntry, ...(prev.balanceLog || [])];
        return {
          ...prev,
          balanceLog: newLog.sort((a, b) => b.timestamp - a.timestamp)
        };
      });
      setBalanceForm({});
      setBalanceTime(getCurrentTimeStr());
      setIsSubmitting(false);
    } catch (error: any) {
      setIsSubmitting(false);
      console.error(error);
      alert('Error al agregar balance en Airtable: ' + (error.message || error));
    }
  };

  const stats = getBalanceStats();
  const isTPE = formData.prescription.mode === TherapyMode.TPE;
  const isSLED = formData.prescription.mode === TherapyMode.SLED;

  // Filter replacement fluids based on mode
  const filteredReplacementFluids = isTPE 
    ? [ReplacementFluid.ALBUMIN_3, ReplacementFluid.ALBUMIN_4, ReplacementFluid.ALBUMIN_5, ReplacementFluid.PFC]
    : Object.values(ReplacementFluid).filter(f => ![ReplacementFluid.ALBUMIN_3, ReplacementFluid.ALBUMIN_4, ReplacementFluid.ALBUMIN_5, ReplacementFluid.PFC].includes(f as any));

  return (
    <div className="flex flex-col h-full bg-hpu-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-hpu-800 border-b border-hpu-600 shadow-md z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition">
            &larr; Volver
          </button>
          <h1 className="text-xl font-bold text-white hidden md:block">
            {patient ? `Editando: ${formData.fullName}` : 'Nuevo Paciente'}
          </h1>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={savePatient} 
             disabled={isSubmitting}
             className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />} Guardar
           </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-hpu-800 border-b border-hpu-600 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab(1)} className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 1 ? 'border-blue-500 text-blue-400 bg-blue-900/20' : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-hpu-700/50'}`}>
          <span className="flex items-center justify-center gap-2"><UserIcon size={16}/> Datos Filiatorios</span>
        </button>
        <button onClick={() => setActiveTab(2)} className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 2 ? 'border-indigo-500 text-indigo-400 bg-indigo-900/20' : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-hpu-700/50'}`}>
          <span className="flex items-center justify-center gap-2"><FileText size={16}/> Prescripción</span>
        </button>
        <button onClick={() => setActiveTab(3)} className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 3 ? 'border-emerald-500 text-emerald-400 bg-emerald-900/20' : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-hpu-700/50'}`}>
          <span className="flex items-center justify-center gap-2"><Activity size={16}/> Monitoreo</span>
        </button>
        {patient && (
          <button onClick={() => setActiveTab(5)} className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 5 ? 'border-cyan-500 text-cyan-400 bg-cyan-900/20' : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-hpu-700/50'}`}>
            <span className="flex items-center justify-center gap-2"><Droplets size={16}/> Balance Hídrico</span>
          </button>
        )}
        {patient && (
          <button onClick={() => setActiveTab(4)} className={`flex-1 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 4 ? 'border-amber-500 text-amber-400 bg-amber-900/20' : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-hpu-700/50'}`}>
            <span className="flex items-center justify-center gap-2"><ClipboardList size={16}/> Resumen</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
        {/* Tab 1: Filiatorios */}
        {activeTab === 1 && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-gray-400 text-sm">Nombre Completo</label>
              <input type="text" value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-sm">Historia Clínica</label>
              <input type="text" value={formData.mrn} onChange={(e) => handleInputChange('mrn', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-sm">Fecha de Nacimiento</label>
              <input type="date" value={formData.dob} onChange={(e) => handleInputChange('dob', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white focus:border-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-sm">Edad</label>
              <input type="text" value={calculateAge(formData.dob)} readOnly className="w-full bg-hpu-800 border border-hpu-600 rounded p-2 text-gray-400 cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-sm">Peso (Kg)</label>
              <input type="number" value={formData.weight} onChange={(e) => handleInputChange('weight', Number(e.target.value))} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white focus:border-blue-500" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-gray-400 text-sm">Diagnóstico</label>
              <textarea value={formData.diagnosis} onChange={(e) => handleInputChange('diagnosis', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white focus:border-blue-500 h-24" />
            </div>
            <div className="space-y-2">
              <label className="text-gray-400 text-sm">Estado</label>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => handleInputChange('isActive', e.target.checked)} className="w-5 h-5" />
                <span className="text-white">Paciente Activo en Tratamiento</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Prescription */}
        {activeTab === 2 && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-gray-400 text-sm">Modalidad</label>
                <select value={formData.prescription.mode} onChange={(e) => handlePrescriptionChange('mode', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white focus:border-blue-500 font-bold" disabled={!isAdmin && patient !== undefined}>
                  {Object.values(TherapyMode).filter(mode => mode !== TherapyMode.MARS).map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                  {formData.prescription.mode === TherapyMode.MARS && <option value={TherapyMode.MARS}>{TherapyMode.MARS}</option>}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-gray-400 text-sm">Fecha Inicio</label>
                <input type="datetime-local" value={formData.prescription.startDate || ''} onChange={(e) => handlePrescriptionChange('startDate', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white" />
              </div>
               <div className="space-y-2">
                <label className="text-gray-400 text-sm">Sitio de Acceso</label>
                <select value={formData.prescription.accessSite} onChange={(e) => handlePrescriptionChange('accessSite', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white">
                  {Object.values(AccessSite).map(site => <option key={site} value={site}>{site}</option>)}
                </select>
              </div>
              
              {/* Filter and Filter Number */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-gray-400 text-sm">Filtro</label>
                  <select value={formData.prescription.filterType || ''} onChange={(e) => handlePrescriptionChange('filterType', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white">
                    <option value="" disabled>Seleccionar...</option>
                    {Object.values(FilterType).map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-gray-400 text-sm">Número de filtro</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 12345"
                    value={formData.prescription.filterNumber || ''} 
                    onChange={(e) => handlePrescriptionChange('filterNumber', e.target.value)} 
                    className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white focus:border-blue-500" 
                  />
                </div>
              </div>

              {!isSLED && (
                <>
                  <div className="space-y-2">
                    <label className="text-gray-400 text-sm">Líquido de Reposición</label>
                    <select value={formData.prescription.replacementFluid || ''} onChange={(e) => handlePrescriptionChange('replacementFluid', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white">
                      <option value="" disabled>Seleccionar...</option>
                      {filteredReplacementFluids.map(fluid => <option key={fluid} value={fluid}>{fluid}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-gray-400 text-sm">Lugar de Reposición</label>
                    <select value={formData.prescription.replacementSite} onChange={(e) => handlePrescriptionChange('replacementSite', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white">
                      {Object.values(ReplacementSite).map(site => <option key={site} value={site}>{site}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className="text-gray-400 text-sm">Anticoagulación</label>
                <select value={formData.prescription.anticoagulation} onChange={(e) => handlePrescriptionChange('anticoagulation', e.target.value)} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white">
                  {Object.values(AnticoagulationType).map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                 <label className="flex items-center gap-3 p-2.5 w-full bg-hpu-700 border border-hpu-600 rounded cursor-pointer hover:bg-hpu-600">
                    <input type="checkbox" checked={formData.prescription.hemoadsorption || false} onChange={(e) => handlePrescriptionChange('hemoadsorption', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
                    <span className="text-white font-medium">Hemoadsorción</span>
                 </label>
              </div>
            </div>

            {/* Dosing Section */}
            {!isSLED && (
              <div className="bg-hpu-800 p-6 rounded-lg border border-hpu-600">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-hpu-600 pb-2 flex items-center gap-2">
                  <RefreshCw size={20} className="text-blue-400"/> {isTPE ? 'Cálculo de Volumen Plasmático' : 'Dosis y Distribución'}
                </h3>
                {isTPE ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase">Hematocrito (Hto)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={formData.prescription.hematocrit || ''} onChange={(e) => handlePrescriptionChange('hematocrit', e.target.value)} className="w-full bg-hpu-700 border border-blue-500 rounded p-2 text-white font-bold" placeholder="0" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase">Volumen Plasmático a Tratar (VPT)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={formData.prescription.plasmaVolumeToTreat || 0} readOnly className="w-full bg-hpu-800 border border-hpu-600 rounded p-2 text-gray-300 font-bold cursor-not-allowed" />
                          <span className="text-xs text-gray-500">ml</span>
                        </div>
                      </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase">Dosis Total</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={formData.prescription.totalDose || ''} onChange={(e) => handlePrescriptionChange('totalDose', Number(e.target.value))} className="w-full bg-hpu-700 border border-blue-500 rounded p-2 text-white font-bold" placeholder="0" />
                          <span className="text-xs text-gray-500">ml/kg/h</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase">% Dializado (QD)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" max="100" value={formData.prescription.dialysatePercent || 0} onChange={(e) => handlePrescriptionChange('dialysatePercent', Number(e.target.value))} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase">% Reposición (QRF)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" max="100" value={formData.prescription.replacementPercent || 0} onChange={(e) => handlePrescriptionChange('replacementPercent', Number(e.target.value))} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white" />
                          <span className="text-xs text-gray-500">%</span>
                        </div>
                      </div>
                  </div>
                )}
                <div className="mt-2 p-2 rounded bg-hpu-700/50 text-xs text-gray-400 italic">
                    {isTPE ? '* VPT calculado mediante fórmula: (Peso x 70) x (1 - (Hto/100))' : '* Nota: Los flujos QD y QRF se calculan sobre el volumen restante tras restar la pérdida de peso a la dosis total.'}
                </div>
              </div>
            )}

            {/* Flows Configuration */}
            <div className="bg-hpu-800 p-6 rounded-lg border border-hpu-600">
              <h3 className="text-lg font-bold text-white mb-4 border-b border-hpu-600 pb-2">Configuración de Flujos</h3>
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${isTPE ? 'lg:grid-cols-2' : (isSLED ? 'lg:grid-cols-4' : 'lg:grid-cols-4')} gap-4`}>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 uppercase">QB (Sangre)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={formData.prescription.bloodFlow} onChange={(e) => handlePrescriptionChange('bloodFlow', Number(e.target.value))} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white" />
                    <span className="text-xs text-gray-500">ml/min</span>
                  </div>
                </div>

                {!isTPE && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400 uppercase">QD (Dializado)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={formData.prescription.dialysateFlow || 0} 
                          onChange={isSLED ? (e) => handlePrescriptionChange('dialysateFlow', Number(e.target.value)) : undefined}
                          readOnly={!isSLED} 
                          className={`w-full ${isSLED ? 'bg-hpu-700 border-blue-500' : 'bg-hpu-800 border-hpu-600'} border rounded p-2 text-white font-medium`} 
                        />
                        <span className="text-xs text-gray-500">ml/h</span>
                      </div>
                    </div>
                    {!isSLED && (
                      <div className="space-y-1">
                        <label className="text-xs text-gray-400 uppercase">QRF (Reposición)</label>
                        <div className="flex items-center gap-2">
                          <input type="number" value={formData.prescription.replacementFlow || 0} readOnly className="w-full bg-hpu-800 border border-hpu-600 rounded p-2 text-gray-300 font-medium" />
                          <span className="text-xs text-gray-500">ml/h</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {isSLED && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 uppercase">Horas de Tratamiento</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={formData.prescription.sledTreatmentHours || ''} onChange={(e) => handlePrescriptionChange('sledTreatmentHours', Number(e.target.value))} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white" />
                      <span className="text-xs text-gray-500">hs</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                   <label className="text-xs text-gray-400 uppercase">Pérdida de peso</label>
                   <div className="flex items-center gap-2">
                    <input type="number" value={formData.prescription.fluidRemovalGoal} onChange={(e) => handlePrescriptionChange('fluidRemovalGoal', Number(e.target.value))} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white" />
                    <span className="text-xs text-gray-500">{isSLED ? 'ml' : 'ml/h'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirm Changes Action */}
            <div className="flex justify-center md:justify-end">
               <button 
                 onClick={() => setShowConfirmDialog(true)}
                 className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl transition-all hover:scale-105"
               >
                 <CheckCircle size={20} /> CONFIRMAR CAMBIOS
               </button>
            </div>

            {formData.prescription.anticoagulation === AnticoagulationType.CITRATE && (
              <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-700">
                <h3 className="text-lg font-bold text-blue-200 mb-4 border-b border-blue-700 pb-2 flex items-center gap-2">
                   <AlertTriangle size={20} className="text-yellow-500"/> Protocolo Citrato
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-300 uppercase">Dosis Citrato (ml/h)</label>
                    <input type="number" value={formData.prescription.citrateDose || 0} readOnly className="w-full bg-hpu-800 border border-hpu-600 rounded p-2 text-gray-300 font-medium" />
                  </div>
                </div>
              </div>
            )}

            {formData.prescription.anticoagulation === AnticoagulationType.HEPARIN && (
              <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-700">
                <h3 className="text-lg font-bold text-blue-200 mb-4 border-b border-blue-700 pb-2 flex items-center gap-2">
                   <AlertTriangle size={20} className="text-yellow-500"/> Protocolo Heparina
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-300 uppercase">Dosis (U/kg/h)</label>
                    <input type="number" value={formData.prescription.heparinDose || ''} onChange={(e) => handlePrescriptionChange('heparinDose', Number(e.target.value))} className="w-full bg-hpu-700 border border-hpu-600 rounded p-2 text-white" placeholder="0" />
                  </div>
                   <div className="space-y-1">
                    <label className="text-xs text-gray-300 uppercase">Velocidad (ml/h)</label>
                    <input type="number" value={formData.prescription.heparinRate || 0} readOnly className="w-full bg-hpu-800 border border-hpu-600 rounded p-2 text-gray-300 font-medium" />
                  </div>
                </div>
              </div>
            )}

            {/* Change History Section */}
            <div className="mt-8 border-t border-hpu-600 pt-6">
              <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2"><History size={20}/> Historial de Cambios</h3>
              {formData.prescriptionHistory && formData.prescriptionHistory.length > 0 ? (
                <div className="bg-hpu-800 rounded-lg border border-hpu-600 overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-hpu-700 text-gray-400"><tr><th className="px-4 py-2">Fecha/Hora</th><th className="px-4 py-2">Usuario</th><th className="px-4 py-2">Modificaciones</th></tr></thead>
                     <tbody className="divide-y divide-hpu-700">
                        {formData.prescriptionHistory.map((entry, idx) => (
                           <tr key={idx} className="hover:bg-hpu-700/30">
                              <td className="px-4 py-3 text-gray-300 whitespace-nowrap align-top">{new Date(entry.timestamp).toLocaleString()}</td>
                              <td className="px-4 py-3 text-blue-300 font-medium whitespace-nowrap align-top">{entry.userName}</td>
                              <td className="px-4 py-3 text-gray-400 align-top"><ul className="list-disc list-inside">{entry.changes.map((change, cIdx) => <li key={cIdx}>{change}</li>)}</ul></td>
                           </tr>
                        ))}
                     </tbody>
                   </table>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 italic bg-hpu-800/50 rounded-lg border border-dashed border-hpu-600">
                  No hay cambios registrados en la prescripción.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Monitoring */}
        {activeTab === 3 && (
          <div className="space-y-6">
            <div className="bg-hpu-800 p-4 md:p-6 rounded-lg border border-hpu-600 shadow-lg">
              <div className="mb-4 flex flex-col sm:flex-row gap-4 border-b border-hpu-700 pb-4">
                 <div><label className="text-[10px] uppercase text-gray-400 block mb-1">Fecha</label><input type="date" value={monitorDate} onChange={(e) => setMonitorDate(e.target.value)} className="bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" /></div>
                 <div><label className="text-[10px] uppercase text-gray-400 block mb-1">Hora</label><input type="time" value={monitorTime} onChange={(e) => setMonitorTime(e.target.value)} className="bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" /></div>
              </div>
              <div className="mb-6 border-b border-hpu-700 pb-4">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Heart className="text-red-500" size={20}/> Signos Vitales</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="text-[10px] uppercase text-gray-400">TAM</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.tam || ''} onChange={(e) => handleMonitorChange('tam', e.target.value)} /></div>
                  <div><label className="text-[10px] uppercase text-gray-400">SatO2</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.sato2 || ''} onChange={(e) => handleMonitorChange('sato2', e.target.value)} /></div>
                  <div><label className="text-[10px] uppercase text-gray-400">FC</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.fc || ''} onChange={(e) => handleMonitorChange('fc', e.target.value)} /></div>
                  <div><label className="text-[10px] uppercase text-gray-400">Temp</label><input type="number" step="0.1" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.temp || ''} onChange={(e) => handleMonitorChange('temp', e.target.value)} /></div>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Activity className="text-blue-400" size={20}/> Máquina</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div><label className="text-[10px] uppercase text-gray-400">P. Acceso</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.accessPressure || ''} onChange={(e) => handleMonitorChange('accessPressure', e.target.value)} /></div>
                <div><label className="text-[10px] uppercase text-gray-400">P. Retorno</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.returnPressure || ''} onChange={(e) => handleMonitorChange('returnPressure', e.target.value)} /></div>
                <div><label className="text-[10px] uppercase text-gray-400">PTM</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white font-bold text-yellow-300" value={monitorForm.tmp || ''} onChange={(e) => handleMonitorChange('tmp', e.target.value)} /></div>
                <div><label className="text-[10px] uppercase text-gray-400">Caída P.</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.pressureDrop || ''} onChange={(e) => handleMonitorChange('pressureDrop', e.target.value)} /></div>
                <div><label className="text-[10px] uppercase text-gray-400">FF</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-sm text-white" value={monitorForm.filtrationFraction || ''} onChange={(e) => handleMonitorChange('filtrationFraction', e.target.value)} /></div>
              </div>
              {formData.prescription.anticoagulation === AnticoagulationType.CITRATE && (
                <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-hpu-900/50 rounded">
                   <div><label className="text-[10px] text-gray-400 uppercase">Ca++ i (Sist)</label><input type="number" step="0.01" className="w-full bg-hpu-800 border border-hpu-600 rounded p-2 text-white" value={monitorForm.ionizedCalciumSystemic || ''} onChange={(e) => handleMonitorChange('ionizedCalciumSystemic', e.target.value)} /></div>
                   <div><label className="text-[10px] text-gray-400 uppercase">Ca++ i (Cto)</label><input type="number" step="0.01" className="w-full bg-hpu-800 border border-hpu-600 rounded p-2 text-white" value={monitorForm.ionizedCalciumCircuit || ''} onChange={(e) => handleMonitorChange('ionizedCalciumCircuit', e.target.value)} /></div>
                </div>
              )}
              <div className="mb-4"><label className="text-[10px] text-gray-400 uppercase">Notas</label><textarea className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-white h-20" value={monitorForm.nursingNotes || ''} onChange={(e) => handleMonitorChange('nursingNotes', e.target.value)} /></div>
              <div className="flex justify-end"><button onClick={addMonitorEntry} disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded font-bold transition">{isSubmitting ? <Loader2 className="animate-spin" size={18}/> : null} + Agregar</button></div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-hpu-600">
              <table className="w-full text-sm text-left">
                <thead className="bg-hpu-700 text-gray-300 uppercase"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Vitales</th><th className="px-4 py-3">Acc</th><th className="px-4 py-3">Ret</th><th className="px-4 py-3">PTM</th><th className="px-4 py-3">Caída</th><th className="px-4 py-3">FF</th><th className="px-4 py-3">Ca++</th><th className="px-4 py-3">Obs</th></tr></thead>
                <tbody className="divide-y divide-hpu-600">{formData.monitoringLog.map(entry => <tr key={entry.id} className="hover:bg-hpu-800/50"><td className="px-4 py-3 text-white"><div>{new Date(entry.timestamp).toLocaleDateString()}</div><div className="text-gray-400 text-xs">{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></td><td className="px-4 py-3 text-xs">{entry.tam && `T:${entry.tam}`} {entry.fc && `FC:${entry.fc}`}</td><td className="px-4 py-3">{entry.accessPressure}</td><td className="px-4 py-3">{entry.returnPressure}</td><td className={`px-4 py-3 font-bold ${entry.tmp > 150 ? 'text-red-400' : 'text-green-400'}`}>{entry.tmp}</td><td className="px-4 py-3">{entry.pressureDrop}</td><td className="px-4 py-3">{entry.filtrationFraction}%</td><td className="px-4 py-3 text-xs">{entry.ionizedCalciumSystemic && `S:${entry.ionizedCalciumSystemic}`} {entry.ionizedCalciumCircuit && `C:${entry.ionizedCalciumCircuit}`}</td><td className="px-4 py-3 truncate max-w-[100px]">{entry.nursingNotes}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Tab 5: Balance */}
        {activeTab === 5 && (
          <div className="space-y-6">
            <div className="bg-hpu-800 p-4 rounded border border-hpu-600 shadow-lg">
               <h3 className="text-lg font-bold text-white mb-4">Registro Horario</h3>
               <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                 <div className="space-y-2"><h4 className="text-xs font-bold text-blue-400 uppercase">Vasoactivos</h4>{['noradrenalina', 'vasopresina', 'dobutamina', 'milrinona', 'adrenalina'].map(f => <div key={f} className="flex items-center gap-2"><label className="text-xs text-gray-300 w-24 truncate">{f}</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-1 text-white" value={balanceForm[f as keyof BalanceEntry] || ''} onChange={(e) => handleBalanceChange(f, e.target.value)} /></div>)}</div>
                 <div className="space-y-2"><h4 className="text-xs font-bold text-blue-400 uppercase">Sedación</h4>{['propofol', 'midazolam', 'dexmedetomidina', 'fentanilo'].map(f => <div key={f} className="flex items-center gap-2"><label className="text-xs text-gray-300 w-24 truncate">{f}</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-1 text-white" value={balanceForm[f as keyof BalanceEntry] || ''} onChange={(e) => handleBalanceChange(f, e.target.value)} /></div>)}</div>
                 <div className="space-y-2"><h4 className="text-xs font-bold text-blue-400 uppercase">Otros</h4>{['insulina', 'php', 'antimicrobianos', 'npt'].map(f => <div key={f} className="flex items-center gap-2"><label className="text-xs text-gray-300 w-24 truncate">{f}</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-1 text-white" value={balanceForm[f as keyof BalanceEntry] || ''} onChange={(e) => handleBalanceChange(f, e.target.value)} /></div>)}</div>
                 <div className="space-y-2 bg-red-900/10 p-2 rounded"><h4 className="text-xs font-bold text-red-400 uppercase">Egresos</h4><div className="flex gap-2"><label className="text-xs text-gray-300 w-24 truncate">P. Peso</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-1 text-white" value={balanceForm.ultrafiltration || ''} onChange={(e) => handleBalanceChange('ultrafiltration', e.target.value)} /></div>{['diuresis', 'sng', 'drenajes'].map(f => <div key={f} className="flex gap-2"><label className="text-xs text-gray-300 w-24 truncate">{f}</label><input type="number" className="w-full bg-hpu-900 border border-hpu-600 rounded p-1 text-white" value={balanceForm[f as keyof BalanceEntry] || ''} onChange={(e) => handleBalanceChange(f, e.target.value)} /></div>)}</div>
               </div>
               <div className="mt-6 pt-4 border-t border-hpu-600 flex justify-between items-center"><div className="flex gap-4"><div><span className="text-xs block text-gray-400">Ingresos</span><span className="font-bold text-blue-400">{calculateBalanceTotals().totalIngresos}</span></div><div><span className="text-xs block text-gray-400">Egresos</span><span className="font-bold text-red-400">{calculateBalanceTotals().totalEgresos}</span></div></div><div className="text-center font-bold px-4 py-2 bg-hpu-900 rounded"><span className="text-xs block text-gray-400">Balance</span><span className={calculateBalanceTotals().balance >= 0 ? 'text-green-400' : 'text-red-400'}>{calculateBalanceTotals().balance}</span></div><button onClick={addBalanceEntry} disabled={isSubmitting} className="bg-green-600 text-white px-6 py-2 rounded font-bold">Agregar</button></div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-hpu-800 p-4 rounded border border-hpu-600"><h4 className="text-xs text-gray-400 uppercase">Acumulado</h4><p className={`text-xl font-bold ${stats.accumulated >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.accumulated} ml</p></div>
                <div className="bg-hpu-800 p-4 rounded border border-hpu-600 md:col-span-2"><h4 className="text-xs text-gray-400 uppercase">Turnos 24h</h4><div className="grid grid-cols-4 gap-2 mt-2">{Object.entries(stats.blocks).map(([label, d]) => <div key={label} className="text-center bg-hpu-900 p-1 rounded"><span className="text-[10px] block">{label}</span><span className={`text-xs font-bold ${d.bal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{d.bal}</span></div>)}</div></div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-hpu-600">
              <table className="w-full text-sm text-left"><thead className="bg-hpu-700 uppercase"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Ing</th><th className="px-4 py-3">Egr</th><th className="px-4 py-3">Bal</th></tr></thead><tbody className="divide-y divide-hpu-600">{(formData.balanceLog || []).map(entry => <tr key={entry.id}><td>{new Date(entry.timestamp).toLocaleString()}</td><td className="text-blue-400">{entry.totalIngresos}</td><td className="text-red-400">{entry.totalEgresos}</td><td className={entry.balance >= 0 ? 'text-green-400' : 'text-red-400'}>{entry.balance}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}

        {/* Tab 4: Summary */}
        {activeTab === 4 && patient && (
          <Summary 
            patient={formData} 
            onUpdate={async () => {
              const p = await DataService.getPatientById(formData.id);
              if (p) setFormData(JSON.parse(JSON.stringify(p)));
            }} 
          />
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] backdrop-blur-md p-4">
           <div className="bg-hpu-800 border-2 border-blue-500 rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in duration-200">
              <div className="p-8 text-center space-y-6">
                 <div className="bg-blue-600/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle className="text-blue-500" size={32} />
                 </div>
                 <h3 className="text-2xl font-black text-white">¿Está seguro?</h3>
                 <p className="text-gray-300">Se registrarán los cambios realizados en la prescripción en el historial del paciente.</p>
                 <div className="flex gap-4 pt-2">
                    <button 
                      onClick={() => setShowConfirmDialog(false)}
                      className="flex-1 py-3 bg-hpu-700 hover:bg-hpu-600 text-white font-bold rounded-xl transition"
                    >
                      NO
                    </button>
                    <button 
                      onClick={savePatient}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg transition"
                    >
                      SI
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PatientForm;
