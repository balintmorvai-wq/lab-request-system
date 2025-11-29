import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { 
  Beaker, 
  LayoutDashboard, 
  FileText, 
  Users, 
  TestTube,
  Building2,
  Building,
  Folder,
  Clipboard,  // v7.0
  Truck,  // v7.0.27: Logistics icon
  LogOut, 
  Menu, 
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [laborOpen, setLaborOpen] = useState(true);
  const [orgOpen, setOrgOpen] = useState(true);

  const roleNames = {
    super_admin: 'Super Admin',
    labor_staff: 'Labor munkatárs',  // v7.0.1: lab_staff → labor_staff for consistency
    company_admin: 'Cég Admin',
    company_user: 'Cég dolgozó',
    company_logistics: 'Céges logisztika',  // v7.0.27
    university_logistics: 'Egyetemi logisztika'  // v7.0.27
  };

  const renderSuperAdminMenu = () => (
    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
      <div className="space-y-1">
        <button
          onClick={() => setLaborOpen(!laborOpen)}
          className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-gray-500 uppercase hover:bg-gray-50 rounded-lg"
        >
          <span>Labor</span>
          {laborOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {laborOpen && (
          <div className="space-y-1 pl-2">
            {[
              { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
              { name: 'Laborkérések', href: '/requests', icon: FileText },
              { name: 'Munkalistám', href: '/worklist', icon: Clipboard },  // v7.0.2: Super admin worklist
              { name: 'Logisztika', href: '/logistics', icon: Truck }  // v7.0.27: Logistics module
            ].map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <button
          onClick={() => setOrgOpen(!orgOpen)}
          className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-gray-500 uppercase hover:bg-gray-50 rounded-lg"
        >
          <span>Szervezeti adatok</span>
          {orgOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {orgOpen && (
          <div className="space-y-1 pl-2">
            {[
              { name: 'Szervezeti egységek', href: '/departments', icon: Building2 },
              { name: 'Kategóriák', href: '/categories', icon: Folder },
              { name: 'Vizsgálattípusok', href: '/test-types', icon: TestTube },
              { name: 'Cégek', href: '/companies', icon: Building },
              { name: 'Felhasználók', href: '/users', icon: Users },
              { name: 'Értesítések', href: '/notifications', icon: Bell }  // v8.0
            ].map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );

  const renderRegularMenu = () => {
    let navigation = [];
    
    // v7.0.27: Logisztikai munkatársak - CSAK Logisztika menü
    if (user?.role === 'company_logistics' || user?.role === 'university_logistics') {
      navigation = [
        { name: 'Logisztika', href: '/logistics', icon: Truck }
      ];
    }
    // v7.0: Labor staff számára külön navigáció
    else if (user?.role === 'labor_staff') {
      navigation = [
        // v7.0.13: Dashboard eltávolítva - labor staff egyből munkalistára megy
        { name: 'Munkalistám', href: '/worklist', icon: Clipboard },  // v7.0: Új menüpont
        { name: 'Minden kérés', href: '/requests', icon: FileText },
      ];
    } else {
      navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Laborkérések', href: '/requests', icon: FileText },
      ];
      
      if (user?.role === 'company_admin') {
        navigation.push({ name: 'Felhasználók', href: '/users', icon: Users });
      }
      
      // v7.0.27: Logistics menü company_admin és company_user számára
      if (user?.role === 'company_admin' || user?.role === 'company_user') {
        navigation.push({ name: 'Logisztika', href: '/logistics', icon: Truck });
      }
    }

    return (
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href || 
                          (item.href === '/worklist' && location.pathname.startsWith('/test-results'));
          
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <Beaker className="w-8 h-8 text-indigo-600 mr-3" />
            <div>
              <span className="text-xl font-bold text-gray-900">LabRequest</span>
              <span className="text-xs text-indigo-600 ml-1">v3.1</span>
            </div>
          </div>

          <div className="px-6 py-3 border-b border-gray-200">
            {/* v7.0.17: Cég logó + név */}
            <div className="flex items-center gap-3 mb-2">
              {user?.company_logo && user?.company_id && (
                <img 
                  src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/companies/${user.company_id}/logo`}
                  alt="Cég logó"
                  className="w-10 h-10 rounded-full object-cover border-2 border-indigo-200"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                <div className="text-xs text-gray-500">{roleNames[user?.role]}</div>
              </div>
            </div>
            {/* Company név (ha van) */}
            {user?.company_name && (
              <div className="text-xs text-blue-600 font-medium">🏢 {user.company_name}</div>
            )}
            {/* Department (labor staff-nál) */}
            {user?.role === 'labor_staff' && user?.department_name && (
              <div className="text-xs text-indigo-600 mt-1">🔬 {user.department_name}</div>
            )}
          </div>

          {user?.role === 'super_admin' ? renderSuperAdminMenu() : renderRegularMenu()}

          <div className="px-4 py-4 border-t border-gray-200">
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Kijelentkezés
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 flex items-center h-16 bg-white border-b border-gray-200 px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          <div className="flex-1" />
          
          <NotificationBell />
        </div>

        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
