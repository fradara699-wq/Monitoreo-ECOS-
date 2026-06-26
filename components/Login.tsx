import React, { useState } from 'react';
import { AuthService } from '../services/dataService';
import { User } from '../types';
import { Activity } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const user = await AuthService.login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Credenciales inválidas. (Prueba: admin/1234 o user/1234)');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-hpu-900">
      <div className="w-full max-w-md p-8 space-y-6 bg-hpu-800 rounded-lg shadow-xl border border-hpu-700">
        <div className="flex flex-col items-center justify-center">
          <div className="p-3 bg-hpu-700 rounded-full mb-4">
             <Activity className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-center text-white">Hospital Privado Universitario de Córdoba</h1>
          <h2 className="text-lg font-medium text-blue-200 mt-2">Soporte Extracorpóreo</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-hpu-900 border border-hpu-600 rounded focus:outline-none focus:border-blue-500"
              placeholder="Ingrese usuario"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 mt-1 text-white bg-hpu-900 border border-hpu-600 rounded focus:outline-none focus:border-blue-500"
              placeholder="••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
