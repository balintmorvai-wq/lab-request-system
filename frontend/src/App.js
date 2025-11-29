import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import UserManagement from './components/UserManagement';
import TestTypeManagement from './components/TestTypeManagement';
import DepartmentManagement from './components/DepartmentManagement';
import CompanyManagement from './components/CompanyManagement';
import CategoryManagement from './components/CategoryManagement';
import WorkList from './components/WorkList';  // v7.0
import TestResultsPanel from './components/TestResultsPanel';  // v7.0
import Logistics from './components/Logistics';  // v7.0.27
import QRScanner from './components/QRScanner';  // v7.0.31
import NotificationManagement from './components/NotificationManagement';  // v8.0
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';

function PrivateRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Betöltés...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  
  // v7.0.13: Labor staff átirányítás munkalistára
  // v7.0.28: Logistics munkatársak átirányítás logisztikára
  let defaultRoute = '/dashboard';
  if (user?.role === 'labor_staff') {
    defaultRoute = '/worklist';
  } else if (user?.role === 'company_logistics' || user?.role === 'university_logistics') {
    defaultRoute = '/logistics';
  }
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={defaultRoute} /> : <Login />} />
      
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to={defaultRoute} />} />
        <Route path="dashboard" element={
          user?.role === 'labor_staff' 
            ? <Navigate to="/worklist" /> 
            : <Dashboard />
        } />
        <Route path="requests" element={<RequestList />} />
        <Route path="requests/new" element={<RequestForm />} />
        <Route path="requests/edit/:id" element={<RequestForm />} />
        
        <Route 
          path="departments" 
          element={
            <PrivateRoute allowedRoles={['super_admin']}>
              <DepartmentManagement />
            </PrivateRoute>
          } 
        />
        
        <Route 
          path="categories" 
          element={
            <PrivateRoute allowedRoles={['super_admin']}>
              <CategoryManagement />
            </PrivateRoute>
          } 
        />
        
        <Route 
          path="test-types" 
          element={
            <PrivateRoute allowedRoles={['super_admin']}>
              <TestTypeManagement />
            </PrivateRoute>
          } 
        />
        
        <Route 
          path="companies" 
          element={
            <PrivateRoute allowedRoles={['super_admin']}>
              <CompanyManagement />
            </PrivateRoute>
          } 
        />
        
        {/* v8.0: Értesítések kezelése */}
        <Route 
          path="notifications" 
          element={
            <PrivateRoute allowedRoles={['super_admin']}>
              <NotificationManagement />
            </PrivateRoute>
          } 
        />
        
        <Route 
          path="users" 
          element={
            <PrivateRoute allowedRoles={['super_admin', 'company_admin']}>
              <UserManagement />
            </PrivateRoute>
          } 
        />
        
        {/* v7.0: Labor munkatárs munkalista + v7.0.2: super_admin */}
        <Route 
          path="worklist" 
          element={
            <PrivateRoute allowedRoles={['labor_staff', 'super_admin']}>
              <WorkList />
            </PrivateRoute>
          } 
        />
        
        {/* v7.0.27: Logisztikai modul */}
        <Route 
          path="logistics" 
          element={
            <PrivateRoute allowedRoles={['super_admin', 'university_logistics', 'company_logistics', 'company_admin', 'company_user']}>
              <Logistics />
            </PrivateRoute>
          } 
        />
        
        {/* v7.0.31: QR kód beolvasás */}
        <Route 
          path="logistics/scan" 
          element={
            <PrivateRoute allowedRoles={['university_logistics', 'company_logistics']}>
              <QRScanner />
            </PrivateRoute>
          } 
        />
        
        {/* v7.0: Vizsgálati eredmények kitöltése */}
        <Route 
          path="test-results/:id" 
          element={
            <PrivateRoute allowedRoles={['labor_staff', 'super_admin']}>
              <TestResultsPanel />
            </PrivateRoute>
          } 
        />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
