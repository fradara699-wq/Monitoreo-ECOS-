
import React, { useState } from 'react';
import { Patient, TherapyMode, TerminationReason } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, Droplets, Activity, Zap, TrendingUp, Scale, Calculator, Power, X } from 'lucide-react';
import { DataService } from '../services/dataService';

interface SummaryProps {
  patient: Patient;
  onUpdate?: () => void;
}

const Summary: React.FC<SummaryProps> = ({ patient, onUpdate }) => {
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [reason, setReason] = useState<TerminationReason | ''>('');

  // Process data for charts
  const data = [...patient.monitoringLog].reverse().map(entry => ({
    time: new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tmp: entry.tmp,
    pressureDrop: entry.pressureDrop,
    access: entry.accessPressure
  }));

  const lastEntry = patient.monitoringLog[0];
  const p = patient.prescription;
  const isTPE = p.mode === TherapyMode.TPE;
  const isSLED = p.mode === TherapyMode.SLED;

  const getTreatmentHours = () => {
    if (!p.startDate) return '-';
    const start = new Date(p.startDate).getTime();
    const end = patient.isActive ? Date.now() : (patient.endDate ? new Date(patient.endDate).getTime() : Date.now());
    const diffMs = end - start;
    if (diffMs < 0) return 'Pendiente';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return `${hours} hs`;
  };

  const balanceAccumulated = (patient.balanceLog || []).reduce((acc, curr) => acc + curr.balance, 0);

  const handleFinishTreatment = async () => {
    if (!reason) {
      alert('Debe seleccionar una causa de fin');
      return;
    }
    const updatedPatient = {
      ...patient,
      isActive: false,
      endDate: new Date().toISOString(),
      terminationReason: reason as TerminationReason
    };
    await DataService.savePatient(updatedPatient);
    setShowFinishModal(false);
    if (onUpdate) onUpdate();
  };

  const Card = ({ title, value, subtext, icon, colorClass = "text-white" }: any) => (
    <div className="bg-hpu-800 p-4 rounded-lg border border-hpu-600 flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">{title}</span>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      <div>
        <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
        {subtext && <span className="text-xs text-gray-500 ml-1">{subtext}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Row 1: Key Treatment Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          title="Horas de Tratamiento" 
          value={getTreatmentHours()} 
          icon={<Clock size={16} />}
          colorClass="text-blue-300"
        />
        <Card 
          title="Balance Acumulado" 
          value={`${balanceAccumulated > 0 ? '+' : ''}${balanceAccumulated}`} 
          subtext="ml"
          colorClass={balanceAccumulated >= 0 ? "text-green-400" : "text-red-400"}
          icon={<Scale size={16} />}
        />
        {isTPE ? (
          <Card 
            title="VPT (Vol. Plasmático)" 
            value={p.plasmaVolumeToTreat || '-'} 
            subtext="ml"
            icon={<Calculator size={16} />}
            colorClass="text-purple-400"
          />
        ) : !isSLED ? (
          <Card 
            title="Dosis Total" 
            value={p.totalDose || '-'} 
            subtext="ml/kg/h"
            icon={<Zap size={16} />}
          />
        ) : (
          <Card 
            title="Peso (Kg)" 
            value={patient.weight || '-'} 
            subtext="Kg"
            icon={<Activity size={16} />}
          />
        )}
        <Card 
          title="Pérdida de Peso" 
          value={p.fluidRemovalGoal} 
          subtext={isSLED ? "ml" : "ml/h"}
          colorClass="text-yellow-300"
          icon={<Droplets size={16} />}
        />
      </div>

      {/* Control Actions */}
      {patient.isActive && (
        <div className="flex justify-end">
          <button 
            onClick={() => setShowFinishModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg transition"
          >
            <Power size={18} /> FINALIZAR TRATAMIENTO
          </button>
        </div>
      )}

      {!patient.isActive && patient.terminationReason && (
        <div className="bg-red-900/20 border border-red-700/50 p-4 rounded-lg">
           <h4 className="text-red-400 font-bold uppercase text-xs mb-1">Tratamiento Finalizado</h4>
           <p className="text-white text-sm">Causa: <span className="font-bold">{patient.terminationReason}</span></p>
           <p className="text-gray-400 text-xs mt-1">Finalizado el: {new Date(patient.endDate!).toLocaleString()}</p>
        </div>
      )}

      {/* Row 2: Flows */}
      <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-${(isTPE || isSLED) ? '3' : '5'} gap-4`}>
        <div className="bg-hpu-800 p-3 rounded-lg border border-hpu-600">
          <p className="text-xs text-gray-400 uppercase font-bold">Qb (Sangre)</p>
          <p className="text-xl font-bold text-white">{p.bloodFlow} <span className="text-xs font-normal text-gray-500">ml/min</span></p>
        </div>
        
        {(!isTPE && !isSLED) && (
          <>
            <div className="bg-hpu-800 p-3 rounded-lg border border-hpu-600">
              <p className="text-xs text-gray-400 uppercase font-bold">QD (Dializado)</p>
              <p className="text-xl font-bold text-white">{p.dialysateFlow || 0} <span className="text-xs font-normal text-gray-500">ml/h</span></p>
            </div>
            <div className="bg-hpu-800 p-3 rounded-lg border border-hpu-600">
              <p className="text-xs text-gray-400 uppercase font-bold">QRF (Reposición)</p>
              <p className="text-xl font-bold text-white">{p.replacementFlow || 0} <span className="text-xs font-normal text-gray-500">ml/h</span></p>
            </div>
          </>
        )}

        {isSLED && (
          <div className="bg-hpu-800 p-3 rounded-lg border border-hpu-600">
            <p className="text-xs text-gray-400 uppercase font-bold">QD (Dializado)</p>
            <p className="text-xl font-bold text-white">{p.dialysateFlow || 0} <span className="text-xs font-normal text-gray-500">ml/h</span></p>
          </div>
        )}

        {isTPE && (
          <div className="bg-hpu-800 p-3 rounded-lg border border-hpu-600">
            <p className="text-xs text-gray-400 uppercase font-bold">Hto</p>
            <p className="text-xl font-bold text-white">{p.hematocrit || 0} <span className="text-xs font-normal text-gray-500">%</span></p>
          </div>
        )}
        
        {/* Monitoring Snapshots */}
        <div className={`bg-hpu-900 p-3 rounded-lg border border-hpu-700 ${(isTPE || isSLED) ? 'md:col-span-1' : 'md:col-span-2'} grid grid-cols-3 gap-2`}>
            <div>
               <p className="text-[10px] text-gray-400 uppercase">Última PTM</p>
               <p className={`text-lg font-bold ${lastEntry && lastEntry.tmp > 150 ? 'text-red-400' : 'text-green-400'}`}>
                 {lastEntry ? lastEntry.tmp : '-'}
               </p>
            </div>
             <div>
               <p className="text-[10px] text-gray-400 uppercase">Última P Acceso</p>
               <p className="text-lg font-bold text-white">
                 {lastEntry ? lastEntry.accessPressure : '-'}
               </p>
            </div>
             <div>
               <p className="text-[10px] text-gray-400 uppercase">FF</p>
               <p className="text-lg font-bold text-blue-200">
                 {lastEntry && lastEntry.filtrationFraction ? `${lastEntry.filtrationFraction}%` : '-'}
               </p>
            </div>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-hpu-800 p-4 rounded-lg border border-hpu-600">
        <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
           <Activity size={18} className="text-blue-400" /> 
           Tendencias de Presiones (Últimas 24hs)
        </h3>
        <div className="h-64 w-full">
           {data.length > 0 ? (
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                <Line type="monotone" dataKey="tmp" stroke="#ef4444" name="PTM" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pressureDrop" stroke="#eab308" name="Caída Presión" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="access" stroke="#60a5fa" name="P. Acceso" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
           ) : (
             <div className="flex items-center justify-center h-full text-gray-500">Sin datos de monitoreo</div>
           )}
        </div>
      </div>

      {/* Finish Treatment Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
           <div className="bg-hpu-800 border border-hpu-600 rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center p-4 border-b border-hpu-600">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Power size={20} className="text-red-500"/> Finalizar Tratamiento
                 </h3>
                 <button onClick={() => setShowFinishModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                 <p className="text-gray-300 text-sm">Se registrará la fecha y hora actual como fin de terapia.</p>
                 <div className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase font-bold">Causa de fin (Obligatorio)</label>
                    <select 
                      value={reason} 
                      onChange={(e) => setReason(e.target.value as TerminationReason)}
                      className="w-full bg-hpu-900 border border-hpu-600 rounded p-3 text-white focus:border-red-500 focus:outline-none"
                    >
                       <option value="" disabled>Seleccionar causa...</option>
                       {Object.values(TerminationReason).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>
              </div>
              <div className="p-4 border-t border-hpu-600 flex justify-end gap-3 bg-hpu-900/30">
                 <button onClick={() => setShowFinishModal(false)} className="px-4 py-2 text-gray-300 hover:text-white font-medium">Cancelar</button>
                 <button 
                  onClick={handleFinishTreatment}
                  disabled={!reason}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition"
                 >
                    Confirmar Cierre
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Summary;
