
import React, { useEffect, useState } from 'react';
import { DataService } from '../services/dataService';
import { Patient, User, UserRole } from '../types';
import { UserPlus, Edit, Activity, Search, Filter } from 'lucide-react';

interface PatientListProps {
  user: User;
  onSelectPatient: (patient: Patient) => void;
  onNewPatient: () => void;
}

const PatientList: React.FC<PatientListProps> = ({ user, onSelectPatient, onNewPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filter, setFilter] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    const data = await DataService.getPatients();
    setPatients(data);
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(filter.toLowerCase()) || p.mrn.includes(filter);
    const matchesStatus = showActiveOnly ? p.isActive : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-blue-400" /> Pacientes
        </h2>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition border text-sm font-medium ${
              showActiveOnly 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-hpu-800 border-hpu-600 text-gray-300 hover:bg-hpu-700'
            }`}
          >
            <Filter size={16} />
            {showActiveOnly ? 'Solo Activos' : 'Todos'}
          </button>

          <button 
            onClick={onNewPatient}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md transition text-sm font-medium"
          >
            <UserPlus size={18} /> Nuevo Ingreso
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nombre o historia clínica..."
          className="w-full pl-10 pr-4 py-3 bg-hpu-800 border border-hpu-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPatients.map(patient => (
          <div 
            key={patient.id}
            onClick={() => onSelectPatient(patient)}
            className={`cursor-pointer p-4 rounded-lg border transition hover:scale-[1.01] ${patient.isActive ? 'bg-hpu-800 border-hpu-600 hover:border-blue-500' : 'bg-gray-800 border-gray-700 opacity-60'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold text-blue-100">{patient.fullName}</h3>
                <p className="text-sm text-blue-300">HC: {patient.mrn}</p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${patient.isActive ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-300'}`}>
                {patient.isActive ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
            
            <div className="space-y-1 text-sm text-gray-400">
              <p>Modo: <span className="text-white font-medium">{patient.prescription.mode}</span></p>
              <p>Anticoagulación: <span className="text-white">{patient.prescription.anticoagulation}</span></p>
              <p>Acceso: {patient.prescription.accessSite}</p>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm">
                <Edit size={16} /> Gestionar
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {filteredPatients.length === 0 && (
        <div className="text-center text-gray-500 py-10">
          No se encontraron pacientes.
        </div>
      )}
    </div>
  );
};

export default PatientList;
