import { ReactNode, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FolderOpen,
  MessageSquare,
  Home,
  ChevronDown,
  ChevronRight,
  Layers,
  Bot,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modulesOpen, setModulesOpen] = useState(true);

  const user = session?.user as any;
  const isAdmin = user?.grupo === 'adm';
  const permissions = user?.permissions || {};
  const userModules = user?.modules || [];

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <span className="font-bold text-gray-800">Knowledge Base</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
              router.pathname === '/dashboard'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Home className="w-5 h-5" />
            {sidebarOpen && <span>Dashboard</span>}
          </Link>

          {/* Admin Menu */}
          {isAdmin && (
            <>
              <div className={`${sidebarOpen ? 'px-3' : 'px-1'} py-2 text-xs font-semibold text-gray-400 uppercase`}>
                {sidebarOpen ? 'Administração' : '---'}
              </div>
              <Link
                href="/admin/users"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  router.pathname.startsWith('/admin/users')
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Users className="w-5 h-5" />
                {sidebarOpen && <span>Usuários</span>}
              </Link>
              <Link
                href="/admin/modules"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  router.pathname.startsWith('/admin/modules')
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Layers className="w-5 h-5" />
                {sidebarOpen && <span>Módulos</span>}
              </Link>
              <Link
                href="/admin/llm-models"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  router.pathname.startsWith('/admin/llm-models')
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Bot className="w-5 h-5" />
                {sidebarOpen && <span>Modelos LLM</span>}
              </Link>
            </>
          )}

          {/* User Menu - Cadastrar */}
          {(isAdmin || permissions.cadastrar) && (
            <>
              <div className={`${sidebarOpen ? 'px-3' : 'px-1'} py-2 text-xs font-semibold text-gray-400 uppercase`}>
                {sidebarOpen ? 'Cadastrar' : '---'}
              </div>
              
              {/* Módulos do usuário */}
              {sidebarOpen ? (
                <div>
                  <button
                    onClick={() => setModulesOpen(!modulesOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="w-5 h-5" />
                      <span>Módulos</span>
                    </div>
                    {modulesOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {modulesOpen && (
                    <div className="ml-8 mt-1 space-y-1">
                      {isAdmin ? (
                        <Link
                          href="/modules"
                          className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Ver todos os módulos
                        </Link>
                      ) : (
                        userModules.map((mod: any) => (
                          <Link
                            key={mod.id}
                            href={`/modules/${mod.id}`}
                            className={`block px-3 py-2 text-sm rounded-lg transition ${
                              router.asPath === `/modules/${mod.id}`
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {mod.nome}
                          </Link>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/modules"
                  className="flex items-center justify-center px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <FolderOpen className="w-5 h-5" />
                </Link>
              )}
            </>
          )}

          {/* Bate-papo */}
          {(isAdmin || permissions.batepapo) && (
            <Link
              href="/chat"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                router.pathname === '/chat'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {sidebarOpen && <span>Bate-papo</span>}
            </Link>
          )}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-semibold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`mt-4 w-full flex items-center ${
              sidebarOpen ? 'justify-start gap-3' : 'justify-center'
            } px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition`}
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
