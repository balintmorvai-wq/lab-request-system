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
import CategoryManagement from './components/CategoryManagement';  // v6.4
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
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
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
        
        <Route 
          path="users" 
          element={
            <PrivateRoute allowedRoles={['super_admin', 'company_admin']}>
              <UserManagement />
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
