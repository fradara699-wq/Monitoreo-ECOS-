import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import PatientList from './components/PatientList';
import PatientForm from './components/PatientForm';
import { AuthService } from './services/dataService';
import { User, Patient, UserRole } from './types';
import { LogOut, ChevronDown, UserCog, Key, Shield, X, Save, Menu, Activity, UserPlus, Heart } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'LIST' | 'FORM'>('LIST');
  const [selectedPatient, setSelectedPatient] = useState<Patient | undefined>(undefined);
  
  // User Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Profile Form State
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Admin Management State
  const [usersList, setUsersList] = useState<User[]>([]);

  useEffect(() => {
    // Close menus when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setNewName(user.name);
    setCurrentView('LIST');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedPatient(undefined);
    setIsMenuOpen(false);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setCurrentView('FORM');
  };

  const handleNewPatient = () => {
    setSelectedPatient(undefined);
    setCurrentView('FORM');
  };

  const handleBackToList = () => {
    setSelectedPatient(undefined);
    setCurrentView('LIST');
  };

  // Profile Management
  const openProfileModal = () => {
    if (currentUser) {
      setNewName(currentUser.name);
      setNewPassword('');
      setIsProfileModalOpen(true);
      setIsMenuOpen(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (currentUser) {
      await AuthService.updateUser(currentUser.id, newName, newPassword);
      setCurrentUser({ ...currentUser, name: newName });
      setIsProfileModalOpen(false);
      alert('Perfil actualizado correctamente');
    }
  };

  // Admin Management
  const openAdminModal = async () => {
    const users = await AuthService.getUsers();
    setUsersList(users);
    setIsAdminModalOpen(true);
    setIsMenuOpen(false);
  };

  const toggleUserRole = async (targetUserId: string, currentRole: UserRole) => {
    const newRole = currentRole === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN;
    await AuthService.updateUserRole(targetUserId, newRole);
    // Refresh list
    const users = await AuthService.getUsers();
    setUsersList(users);
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen flex flex-col bg-hpu-900 text-hpu-100 font-sans">
      {/* Top Navigation */}
      <nav className="bg-hpu-800 border-b border-hpu-600 px-4 py-3 flex justify-between items-center z-50 relative">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={handleBackToList}>
            <div className="bg-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-md">HP</div>
            <div className="flex flex-col">
               <span className="font-bold text-white leading-tight">Hospital Privado Universitario</span>
               <span className="font-light text-blue-300 text-xs">Soporte Extracorpóreo</span>
            </div>
          </div>
          
          {/* Desktop Horizontal Navigation */}
          <div className="hidden lg:flex items-center gap-1 border-l border-hpu-600 pl-4 ml-2">
            <button
              onClick={handleBackToList}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                currentView === 'LIST'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-gray-300 hover:bg-hpu-700 hover:text-white'
              }`}
            >
              <Activity size={16} /> Pacientes
            </button>
            <button
              onClick={handleNewPatient}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                currentView === 'FORM' && !selectedPatient
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                  : 'text-gray-300 hover:bg-hpu-700 hover:text-white'
              }`}
            >
              <UserPlus size={16} /> Nuevo Ingreso
            </button>
            {selectedPatient && currentView === 'FORM' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 ml-2 max-w-[200px] truncate" title={selectedPatient.fullName}>
                <Heart size={14} className="animate-pulse text-emerald-500 shrink-0" /> {selectedPatient.fullName}
              </div>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Desktop User Menu */}
          <div className="hidden lg:block relative" ref={menuRef}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-3 p-1.5 px-2.5 rounded-lg hover:bg-hpu-700 transition focus:outline-none select-none"
            >
              <div className="text-right">
                <p className="text-sm font-medium leading-tight text-white">{currentUser.name}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{currentUser.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</p>
              </div>
              <div className="bg-hpu-700 p-1.5 rounded-full">
                 <UserCog size={18} className="text-gray-300" />
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-hpu-800 border border-hpu-600 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-hpu-700 lg:hidden">
                  <p className="text-sm font-medium text-white">{currentUser.name}</p>
                  <p className="text-xs text-gray-400">{currentUser.role}</p>
                </div>
                
                <button 
                  onClick={openProfileModal}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-hpu-700 hover:text-white flex items-center gap-2"
                >
                  <Key size={16} className="text-blue-400" /> Credenciales
                </button>

                {currentUser.role === UserRole.ADMIN && (
                  <button 
                    onClick={openAdminModal}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-hpu-700 hover:text-white flex items-center gap-2"
                  >
                    <Shield size={16} className="text-yellow-500" /> Gestionar Usuarios
                  </button>
                )}
                
                <div className="border-t border-hpu-700 mt-1"></div>
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-hpu-700 hover:text-red-300 flex items-center gap-2"
                >
                  <LogOut size={16} /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Trigger */}
          <div className="lg:hidden flex items-center relative" ref={mobileMenuRef}>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-hpu-700 transition focus:outline-none"
              aria-label="Menú principal"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
              <div className="absolute right-0 top-12 w-64 bg-hpu-800 border border-hpu-600 rounded-lg shadow-xl py-3 z-50 animate-in fade-in slide-in-from-top-5 duration-200">
                <div className="px-4 pb-2 border-b border-hpu-700 mb-2">
                  <p className="text-sm font-bold text-white">{currentUser.name}</p>
                  <p className="text-xs text-blue-400 font-medium">{currentUser.role === 'ADMIN' ? 'Administrador' : 'Usuario'}</p>
                </div>

                {/* Section links */}
                <div className="px-2 space-y-1">
                  <button 
                    onClick={() => {
                      handleBackToList();
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                      currentView === 'LIST' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:bg-hpu-700 hover:text-white'
                    }`}
                  >
                    <Activity size={16} /> Pacientes
                  </button>

                  <button 
                    onClick={() => {
                      handleNewPatient();
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                      currentView === 'FORM' && !selectedPatient 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-300 hover:bg-hpu-700 hover:text-white'
                    }`}
                  >
                    <UserPlus size={16} /> Nuevo Ingreso
                  </button>

                  {selectedPatient && currentView === 'FORM' && (
                    <div className="px-3 py-2 text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-900 rounded-md font-semibold flex items-center gap-2 mx-1 mt-1">
                      <Heart size={14} className="animate-pulse text-emerald-500 shrink-0" />
                      <span className="truncate">{selectedPatient.fullName}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-hpu-700 my-2"></div>

                {/* User actions */}
                <div className="px-2 space-y-1">
                  <button 
                    onClick={() => {
                      openProfileModal();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-hpu-700 hover:text-white flex items-center gap-2"
                  >
                    <Key size={16} className="text-blue-400" /> Credenciales
                  </button>

                  {currentUser.role === UserRole.ADMIN && (
                    <button 
                      onClick={() => {
                        openAdminModal();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-hpu-700 hover:text-white flex items-center gap-2"
                    >
                      <Shield size={16} className="text-yellow-500" /> Gestionar Usuarios
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-hpu-700 hover:text-red-300 flex items-center gap-2"
                  >
                    <LogOut size={16} /> Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === 'LIST' ? (
          <PatientList 
            user={currentUser} 
            onSelectPatient={handleSelectPatient} 
            onNewPatient={handleNewPatient} 
          />
        ) : (
          <PatientForm 
            user={currentUser}
            patient={selectedPatient}
            onBack={handleBackToList}
          />
        )}
      </main>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-hpu-800 border border-hpu-600 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b border-hpu-600">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCog size={20} className="text-blue-400"/> Editar Perfil
              </h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nombre para mostrar</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nueva Contraseña (opcional)</label>
                <input 
                  type="password" 
                  placeholder="Dejar en blanco para mantener actual"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-hpu-900 border border-hpu-600 rounded p-2 text-white"
                />
              </div>
            </div>
            <div className="p-4 border-t border-hpu-600 flex justify-end gap-3">
              <button onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 text-gray-300 hover:text-white">Cancelar</button>
              <button onClick={handleUpdateProfile} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2">
                <Save size={16} /> Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Management Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-hpu-800 border border-hpu-600 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center p-4 border-b border-hpu-600">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield size={20} className="text-yellow-500"/> Gestión de Permisos
              </h3>
              <button onClick={() => setIsAdminModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-400 mb-4">Administre los roles de los usuarios del sistema.</p>
              <div className="border border-hpu-600 rounded overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-hpu-700 text-gray-300">
                    <tr>
                      <th className="p-3">Usuario</th>
                      <th className="p-3">Nombre</th>
                      <th className="p-3 text-center">Rol</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hpu-600 bg-hpu-900">
                    {usersList.map(user => (
                      <tr key={user.id}>
                        <td className="p-3 text-gray-300">{user.username}</td>
                        <td className="p-3 text-white font-medium">{user.name}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs ${user.role === UserRole.ADMIN ? 'bg-yellow-900 text-yellow-200' : 'bg-blue-900 text-blue-200'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => toggleUserRole(user.id, user.role)}
                            disabled={user.id === currentUser.id} // Prevent removing own admin rights
                            className={`text-xs px-3 py-1 rounded border transition ${
                              user.role === UserRole.ADMIN 
                                ? 'border-red-500 text-red-400 hover:bg-red-900/30' 
                                : 'border-green-500 text-green-400 hover:bg-green-900/30'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {user.role === UserRole.ADMIN ? 'Quitar Admin' : 'Hacer Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t border-hpu-600 flex justify-end">
              <button onClick={() => setIsAdminModalOpen(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;