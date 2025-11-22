import React from 'react';
import axios from 'axios';
import { X, MapPin, Calendar, Clock, AlertCircle, User, Building, Phone, Mail, Paperclip, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function RequestDetailsModal({ request, onClose }) {
  const { API_URL, getAuthHeaders } = useAuth();
  if (!request) return null;

  // v6.2: Download attachment with auth
  const handleDownloadAttachment = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/requests/${request.id}/attachment`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', request.attachment_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Hiba történt a fájl letöltése során');
    }
  };

  const statusColors = {
    submitted: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
  };

  const statusLabels = {
    submitted: 'Beküldve',
    in_progress: 'Feldolgozás alatt',
    completed: 'Elkészült',
    closed: 'Lezárva'
  };

  const urgencyLabels = {
    normal: 'Normal',
    urgent: 'Sürgős',
    critical: 'Kritikus'
  };

  const urgencyColors = {
    normal: 'text-gray-600 bg-gray-100',
    urgent: 'text-orange-600 bg-orange-100',
    critical: 'text-red-600 bg-red-100'
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{request.sample_id}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusColors[request.status]}`}>
                {statusLabels[request.status]}
              </span>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${urgencyColors[request.urgency]}`}>
                {urgencyLabels[request.urgency]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-600" />
              Minta információk
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-sm text-gray-600">Minta leírása:</label>
                <p className="text-gray-900">{request.sample_description}</p>
              </div>
            </div>
          </div>

          {/* Test Types */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Kért vizsgálatok</h3>
            <div className="space-y-2">
              {request.test_types && request.test_types.length > 0 ? (
                <>
                  {request.test_types.map((testType, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div>
                        <div className="font-medium text-gray-900">{testType.name}</div>
                      </div>
                      <div className="text-indigo-600 font-semibold">
                        {testType.price.toLocaleString('hu-HU')} Ft
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-300 mt-3">
                    <span className="font-semibold text-gray-900">Összesen:</span>
                    <span className="text-xl font-bold text-indigo-600">
                      {(request.total_price || 0).toLocaleString('hu-HU')} Ft
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Nincs megadva</p>
              )}
            </div>
          </div>

          {/* Location and Dates */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                Mintavétel helye
              </h3>
              <p className="text-gray-900">{request.sampling_location}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Dátumok
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Mintavétel:</span>
                  <span className="text-gray-900">
                    {request.sampling_date 
                      ? new Date(request.sampling_date).toLocaleDateString('hu-HU')
                      : '-'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Határidő:</span>
                  <span className="text-gray-900">
                    {request.deadline 
                      ? new Date(request.deadline).toLocaleDateString('hu-HU')
                      : '-'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Létrehozva:</span>
                  <span className="text-gray-900">
                    {new Date(request.created_at).toLocaleDateString('hu-HU')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Special Instructions */}
          {request.special_instructions && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Különleges kezelési utasítások
              </h3>
              <p className="text-yellow-900">{request.special_instructions}</p>
            </div>
          )}

          {/* Attachment - v6.2 */}
          {request.attachment_filename && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Melléklet
              </h3>
              <button
                onClick={handleDownloadAttachment}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors w-fit"
              >
                <Download className="w-4 h-4" />
                <span>{request.attachment_filename}</span>
              </button>
            </div>
          )}

          {/* Contact Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Feladó
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{request.user_name}</span>
                </div>
                {request.user_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{request.user_email}</span>
                  </div>
                )}
                {request.user_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900">{request.user_phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                Cég
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{request.company_name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Bezárás
          </button>
        </div>
      </div>
    </div>
  );
}

export default RequestDetailsModal;
