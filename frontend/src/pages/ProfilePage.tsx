import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../state/AuthContext';

export function ProfilePage() {
  const { user } = useAuth();
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-ink">Perfil</h1>
        <p className="text-sm text-slate-500">Sesion y configuracion basica.</p>
      </div>
      <div className="panel max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-mint text-white">
            <ShieldCheck />
          </div>
          <div>
            <p className="font-black text-ink">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold">Aislamiento de datos</p>
            <p className="mt-1 text-slate-500">Todas las consultas usan el usuario autenticado.</p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold">Sesion segura</p>
            <p className="mt-1 text-slate-500">Access token corto y refresh token en cookie httpOnly.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
