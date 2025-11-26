import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { 
  AlertCircle, 
  Calendar,
  CalendarCheck,
  Clock,
  MapPin, 
  FileText,
  Save,
  Send,
  Paperclip,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Truck,
  Building,
  Phone,
  User,
  Hash,
  CheckSquare,
  Square,
  // Category icons
  Package,
  Droplet,
  Fuel,
  Droplets,
  Leaf,
  Beaker,
  TreePine,
  Wind,
  BarChart3,
  Gauge
} from 'lucide-react';

// Icon mapping for dynamic rendering
const iconMap = {
  Package, Droplet, Fuel, Droplets, Leaf, Beaker, TreePine, Wind, AlertTriangle, BarChart3, Gauge
};

function RequestForm() {
  const { user, getAuthHeaders, API_URL } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [testTypes, setTestTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState('');
  const [loading, setLoading] = useState(true);
  const [deadlineWarning, setDeadlineWarning] = useState('');
  const [originalStatus, setOriginalStatus] = useState('');
  
  // v6.7 form state
  const [formData, setFormData] = useState({
    // Azonosítók
    internal_id: '',             // Céges belső azonosító (szabadon szerkeszthető)
    // Minta adatok
    sample_description: '',
    sampling_datetime: '',       // Mintavétel időpontja (dátum + óra:perc)
    sampling_location: '',       // Mintavétel helye
    // Feladás részletei
    logistics_type: 'sender',    // 'sender' vagy 'provider'
    shipping_address: '',        // Cím (ha szolgáltató szállít)
    contact_person: '',          // Kontakt személy
    contact_phone: '',           // Telefon
    // Prioritás
    urgency: 'normal',           // 'normal', 'urgent', 'critical'
    deadline: '',                // Határidő (opcionális)
    // Egyéb
    special_instructions: ''
  });

  useEffect(() => {
    fetchTestTypes();
    fetchCategories();
    if (isEditing) {
      loadRequest();
    } else if (user) {
      // Új kérés: kitöltjük az alapértékeket
      setFormData(prev => ({ 
        ...prev, 
        contact_person: user.name || '',
        contact_phone: user.phone || ''
      }));
    }
  }, [id, user, isEditing]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`, {
        headers: getAuthHeaders()
      });
      // Sort categories: "Minta előkészítés" first, then others
      const sortedCategories = response.data
        .filter(c => c.is_active)
        .sort((a, b) => {
          if (a.name === 'Minta előkészítés') return -1;
          if (b.name === 'Minta előkészítés') return 1;
          return 0;
        });
      setCategories(sortedCategories);
      
      // Initialize collapsed state - all collapsed except "Minta előkészítés"
      const initialCollapsedState = {};
      sortedCategories.forEach(cat => {
        initialCollapsedState[cat.id] = cat.name !== 'Minta előkészítés';
      });
      setCollapsedCategories(initialCollapsedState);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const loadRequest = async () => {
    try {
      const response = await axios.get(`${API_URL}/requests/${id}`, {
        headers: getAuthHeaders()
      });
      const req = response.data;
      
      // v6.7: parse sampling_datetime (vagy legacy sampling_date)
      let samplingDatetime = '';
      if (req.sampling_datetime) {
        samplingDatetime = req.sampling_datetime.slice(0, 16); // YYYY-MM-DDTHH:mm
      } else if (req.sampling_date) {
        samplingDatetime = req.sampling_date.split('T')[0] + 'T12:00';
      }
      
      setFormData({
        internal_id: req.internal_id || req.sample_id || '',
        sample_description: req.sample_description || '',
        sampling_datetime: samplingDatetime,
        sampling_location: req.sampling_location || '',
        logistics_type: req.logistics_type || 'sender',
        shipping_address: req.shipping_address || req.sampling_address || '',
        contact_person: req.contact_person || user.name || '',
        contact_phone: req.contact_phone || user.phone || '',
        urgency: req.urgency || 'normal',
        deadline: req.deadline?.split('T')[0] || '',
        special_instructions: req.special_instructions || ''
      });
      
      setSelectedTests(req.test_types.map(tt => tt.id));
      setExistingAttachment(req.attachment_filename || '');
      setOriginalStatus(req.status);
    } catch (error) {
      console.error('Error loading request:', error);
      alert('Hiba történt a kérés betöltése során');
      navigate('/requests');
    }
  };

  // Deadline warning check
  useEffect(() => {
    if (selectedTests.length > 0 && formData.sampling_datetime && formData.deadline) {
      checkDeadlineWarning();
    } else {
      setDeadlineWarning('');
    }
  }, [selectedTests, formData.sampling_datetime, formData.deadline]);

  const fetchTestTypes = async () => {
    try {
      const response = await axios.get(`${API_URL}/test-types`, {
        headers: getAuthHeaders()
      });
      setTestTypes(response.data.filter(tt => tt.is_active));
    } catch (error) {
      console.error('Error fetching test types:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDeadlineWarning = () => {
    // v6.7: sampling_datetime-ból csak a dátum rész
    const samplingDateStr = formData.sampling_datetime?.split('T')[0];
    if (!samplingDateStr) {
      setDeadlineWarning('');
      return;
    }
    
    const samplingDate = new Date(samplingDateStr);
    const deadline = new Date(formData.deadline);
    
    // Get max turnaround time from selected tests
    const selectedTestTypes = testTypes.filter(tt => selectedTests.includes(tt.id));
    if (selectedTestTypes.length === 0) {
      setDeadlineWarning('');
      return;
    }
    
    const maxTurnaround = Math.max(...selectedTestTypes.map(tt => tt.turnaround_days || 7));
    const expectedCompletion = new Date(samplingDate);
    expectedCompletion.setDate(expectedCompletion.getDate() + maxTurnaround);
    
    if (expectedCompletion > deadline) {
      const daysDiff = Math.ceil((expectedCompletion - deadline) / (1000 * 60 * 60 * 24));
      setDeadlineWarning(
        `A legkésőbbi vizsgálat átfutási ideje ${maxTurnaround} nap. ` +
        `Várható befejezés: ${expectedCompletion.toLocaleDateString('hu-HU')}. ` +
        `Ez ${daysDiff} nappal később van, mint a megadott határidő!`
      );
    } else {
      setDeadlineWarning('');
    }
  };

  const toggleTestType = (testTypeId) => {
    setSelectedTests(prev => 
      prev.includes(testTypeId)
        ? prev.filter(id => id !== testTypeId)
        : [...prev, testTypeId]
    );
  };

  // v6.7: kategória összes ki/bejelölése
  const toggleAllInCategory = (categoryId) => {
    const categoryTests = testTypes.filter(tt => tt.category_id === categoryId);
    const categoryTestIds = categoryTests.map(tt => tt.id);
    const allSelected = categoryTestIds.every(id => selectedTests.includes(id));
    
    if (allSelected) {
      // Unselect all in category
      setSelectedTests(prev => prev.filter(id => !categoryTestIds.includes(id)));
    } else {
      // Select all in category
      setSelectedTests(prev => [...new Set([...prev, ...categoryTestIds])]);
    }
  };

  const toggleCategory = (categoryId) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const calculateTotalPrice = () => {
    return selectedTests.reduce((total, testId) => {
      const testType = testTypes.find(tt => tt.id === testId);
      return total + (testType ? testType.price : 0);
    }, 0);
  };

  const handleSubmit = async (e, status = 'pending_approval') => {
    e.preventDefault();

    // Validations with scroll to first error
    const scrollToError = (message, fieldId = null) => {
      alert(message);
      if (fieldId) {
        const element = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
    };

    if (!formData.sample_description || formData.sample_description.trim() === '') {
      scrollToError('Kérlek add meg a minta leírását!', 'sample_description');
      return;
    }

    if (!formData.sampling_datetime) {
      scrollToError('Kérlek add meg a mintavétel időpontját!', 'sampling_datetime');
      return;
    }

    if (!formData.sampling_location || formData.sampling_location.trim() === '') {
      scrollToError('Kérlek add meg a mintavétel helyét!', 'sampling_location');
      return;
    }

    // v6.7: Ha szolgáltató szállít, kötelező a cím
    if (formData.logistics_type === 'provider') {
      if (!formData.shipping_address || formData.shipping_address.trim() === '') {
        scrollToError('Kérlek add meg a szállítási címet!', 'shipping_address');
        return;
      }
    }

    if (!formData.contact_person || formData.contact_person.trim() === '') {
      scrollToError('Kérlek add meg a kontakt személy nevét!', 'contact_person');
      return;
    }

    if (!formData.contact_phone || formData.contact_phone.trim() === '') {
      scrollToError('Kérlek add meg a kontakt személy telefonszámát!', 'contact_phone');
      return;
    }

    if (selectedTests.length === 0) {
      scrollToError('Kérlek válassz ki legalább egy vizsgálattípust!');
      return;
    }

    // File size check
    if (attachmentFile && attachmentFile.size > 20 * 1024 * 1024) {
      scrollToError('A fájl mérete nem lehet nagyobb 20 MB-nál!');
      return;
    }

    // v6.0: Company admin skips approval → directly to submitted
    // v6.6: If editing a rejected request, keep it rejected
    let finalStatus = status;
    if (user?.role === 'company_admin' && status === 'pending_approval') {
      finalStatus = 'submitted';
    } else if (isEditing && originalStatus === 'rejected') {
      finalStatus = 'rejected';
    }

    try {
      // Use FormData for file upload support
      const formDataObj = new FormData();
      
      // v6.7 mezők
      formDataObj.append('internal_id', formData.internal_id);
      formDataObj.append('sample_id', formData.internal_id || 'AUTO'); // Legacy support
      formDataObj.append('sample_description', formData.sample_description);
      formDataObj.append('sampling_datetime', formData.sampling_datetime);
      formDataObj.append('sampling_location', formData.sampling_location);
      formDataObj.append('logistics_type', formData.logistics_type);
      formDataObj.append('shipping_address', formData.shipping_address);
      formDataObj.append('contact_person', formData.contact_person);
      formDataObj.append('contact_phone', formData.contact_phone);
      formDataObj.append('urgency', formData.urgency);
      formDataObj.append('deadline', formData.deadline || '');
      formDataObj.append('special_instructions', formData.special_instructions);
      formDataObj.append('test_types', JSON.stringify(selectedTests));
      formDataObj.append('status', finalStatus);

      // Add attachment if selected
      if (attachmentFile) {
        formDataObj.append('attachment', attachmentFile);
      }

      if (isEditing) {
        // Update existing request
        await axios.put(`${API_URL}/requests/${id}`, formDataObj, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        alert(finalStatus === 'draft' ? 'Piszkozat frissítve!' : 'Kérés frissítve!');
      } else {
        // Create new request
        const response = await axios.post(`${API_URL}/requests`, formDataObj, {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        
        const requestNumber = response.data?.request_number;
        
        // v6.0: Different message for admin
        if (finalStatus === 'submitted') {
          alert(`Laborkérés sikeresen beküldve!\nAzonosító: ${requestNumber}`);
        } else if (finalStatus === 'draft') {
          alert(`Piszkozat sikeresen mentve!\nAzonosító: ${requestNumber}`);
        } else {
          alert(`Laborkérés sikeresen beküldve jóváhagyásra!\nAzonosító: ${requestNumber}`);
        }
      }

      navigate('/requests');
    } catch (error) {
      console.error('Error creating request:', error);
      alert(error.response?.data?.message || 'Hiba történt a mentés során');
    }
  };

  const saveDraft = (e) => {
    handleSubmit(e, 'draft');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Laborkérés szerkesztése' : 'Új laborkérés'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditing ? 'Módosítsd az alábbi mezőket' : 'Töltsd ki az alábbi űrlapot a laborkérés beküldéséhez'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Minta információk - v6.7 újratervezett blokk */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Minta információk
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Céges belső azonosító
                <span className="text-gray-400 ml-1">(opcionális)</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  id="internal_id"
                  value={formData.internal_id}
                  onChange={(e) => setFormData({ ...formData, internal_id: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="pl. PR-2024-0123"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Szabadon megadható, belső nyilvántartáshoz
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minta leírása *
            </label>
            <textarea
              id="sample_description"
              value={formData.sample_description}
              onChange={(e) => setFormData({ ...formData, sample_description: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
              placeholder="Részletes leírás a mintáról..."
            />
          </div>

          {/* Mintavétel idő és hely - ugyanabban a blokkban */}
          <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="inline w-4 h-4 mr-1 text-indigo-600" />
                Mintavétel időpontja *
              </label>
              <div className="relative">
                <input
                  id="sampling_datetime"
                  name="sampling_datetime"
                  type="datetime-local"
                  value={formData.sampling_datetime}
                  onChange={(e) => setFormData({ ...formData, sampling_datetime: e.target.value })}
                  className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setFormData({ ...formData, sampling_datetime: localIso });
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded transition-colors flex items-center gap-1"
                  title="Most"
                >
                  <CalendarCheck className="w-3 h-3" />
                  Most
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="inline w-4 h-4 mr-1 text-indigo-600" />
                Mintavétel helye *
              </label>
              <input
                type="text"
                id="sampling_location"
                value={formData.sampling_location}
                onChange={(e) => setFormData({ ...formData, sampling_location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                placeholder="pl. Finomító - 3-as üzem"
              />
            </div>
          </div>
        </div>

        {/* Prioritás és határidők - v6.7 vízszintes prioritás választó */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Prioritás és határidők
          </h2>

          {/* v6.7: Beszédes vízszintes prioritás választó */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Sürgősség *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'normal', label: 'Normál', icon: '⚪', color: 'border-gray-300 bg-gray-50', activeColor: 'border-green-500 bg-green-50 ring-2 ring-green-200', desc: 'Standard átfutás' },
                { value: 'urgent', label: 'Sürgős', icon: '🟡', color: 'border-gray-300 bg-gray-50', activeColor: 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200', desc: 'Gyorsított feldolgozás' },
                { value: 'critical', label: 'Kritikus', icon: '🔴', color: 'border-gray-300 bg-gray-50', activeColor: 'border-red-500 bg-red-50 ring-2 ring-red-200', desc: 'Azonnali prioritás' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: opt.value })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    formData.urgency === opt.value ? opt.activeColor : opt.color + ' hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{opt.icon}</span>
                    <span className="font-medium">{opt.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Határidő */}
          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Határidő
              <span className="text-gray-400 ml-1">(opcionális)</span>
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {deadlineWarning && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{deadlineWarning}</p>
            </div>
          )}
        </div>

        {/* v6.7: Minta feladás részletei */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Minta feladás részletei
          </h2>

          {/* Logisztika választó - markáns */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Ki gondoskodik a minta eljuttatásáról? *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, logistics_type: 'sender' })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.logistics_type === 'sender'
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building className={`w-6 h-6 ${formData.logistics_type === 'sender' ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium">Feladó gondoskodik</div>
                    <p className="text-xs text-gray-500">Mi juttatjuk el a mintát a laborba</p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, logistics_type: 'provider' })}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  formData.logistics_type === 'provider'
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Truck className={`w-6 h-6 ${formData.logistics_type === 'provider' ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <div className="font-medium">Szolgáltató szállít</div>
                    <p className="text-xs text-gray-500">A labor küldjön futárt a mintáért</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Szállítási cím - csak ha szolgáltató szállít */}
          {formData.logistics_type === 'provider' && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-4">
              <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Szállítási adatok a futár számára
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pontos cím *
                </label>
                <input
                  id="shipping_address"
                  name="shipping_address"
                  type="text"
                  value={formData.shipping_address}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required={formData.logistics_type === 'provider'}
                  placeholder="pl. 2440 Százhalombatta, Ipari út 42."
                />
              </div>
            </div>
          )}

          {/* Kontakt személy és telefon - mindig látszik */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="inline w-4 h-4 mr-1 text-gray-400" />
                Kontakt személy *
              </label>
              <input
                id="contact_person"
                name="contact_person"
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                placeholder="Alapértelmezett: feladó neve"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="inline w-4 h-4 mr-1 text-gray-400" />
                Telefon *
              </label>
              <input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
                placeholder="+36 30 123 4567"
              />
            </div>
          </div>
        </div>

        {/* Test Types - v6.7 Kategória szerint, select all fejléccel */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Vizsgálatok
          </h2>

          {/* Group by Category - v6.7 with select all */}
          {categories
            .filter(cat => cat.is_active)
            .filter(cat => cat.name !== 'Minta előkészítés')  // Elrejtés
            .map((category, index) => {
            const categoryTests = testTypes.filter(tt => tt.category_id === category.id && tt.is_active);
            if (categoryTests.length === 0) return null;
            
            const Icon = iconMap[category.icon] || Beaker;
            const isCollapsed = collapsedCategories[category.id];
            const isSamplePrep = category.name === 'Minta előkészítés';
            
            // v6.7: számláló
            const selectedInCategory = categoryTests.filter(tt => selectedTests.includes(tt.id)).length;
            const totalInCategory = categoryTests.length;
            const allSelected = selectedInCategory === totalInCategory;

            // Helper function to get complementary light background
            const getCategoryBackground = (color) => {
              // Convert hex to RGB and create a very light complementary tint
              const hex = color.replace('#', '');
              const r = parseInt(hex.substr(0, 2), 16);
              const g = parseInt(hex.substr(2, 2), 16);
              const b = parseInt(hex.substr(4, 2), 16);
              
              // Create a very light version (95% white + 5% color)
              return `rgba(${r}, ${g}, ${b}, 0.03)`;
            };

            const getCategoryHeaderBg = (color) => {
              const hex = color.replace('#', '');
              const r = parseInt(hex.substr(0, 2), 16);
              const g = parseInt(hex.substr(2, 2), 16);
              const b = parseInt(hex.substr(4, 2), 16);
              
              // Slightly more intense for header (92% white + 8% color)
              return `rgba(${r}, ${g}, ${b}, 0.08)`;
            };

            return (
              <div 
                key={category.id} 
                className={`border-2 rounded-lg overflow-hidden transition-all duration-300 ease-in-out ${
                  isSamplePrep ? 'border-indigo-400 shadow-md' : 'border-gray-200'
                }`}
                style={{
                  backgroundColor: getCategoryBackground(category.color)
                }}
              >
                {/* Category Header - Clickable to toggle */}
                <div 
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center justify-between p-4 cursor-pointer transition-all duration-200 ease-in-out"
                  style={{ 
                    backgroundColor: getCategoryHeaderBg(category.color),
                    borderBottom: isCollapsed ? 'none' : `2px solid ${category.color}30`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = getCategoryHeaderBg(category.color).replace('0.08', '0.12');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = getCategoryHeaderBg(category.color);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Icon 
                      className="w-6 h-6 transition-transform duration-200" 
                      style={{ color: category.color }}
                    />
                    <div>
                      <h3 
                        className="font-semibold text-lg"
                        style={{ color: category.color }}
                      >
                        {category.name}
                        {isSamplePrep && (
                          <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-1 rounded-full">
                            Kötelező
                          </span>
                        )}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* v6.7: Select all checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllInCategory(category.id);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors"
                      style={{
                        borderColor: `${category.color}40`,
                        backgroundColor: allSelected ? `${category.color}15` : 'white',
                        color: category.color
                      }}
                      title={allSelected ? 'Mind kijelölésének törlése' : 'Mind kijelölése'}
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      <span>{selectedInCategory}/{totalInCategory}</span>
                    </button>
                    <span className="text-sm text-gray-500">
                      {categoryTests.length} vizsgálat
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-gray-400 transition-transform duration-300" />
                    )}
                  </div>
                </div>

                {/* Category Tests - Collapsible with smooth animation */}
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
                  }`}
                >
                  <div className="p-4 space-y-2">
                    {categoryTests.map((testType) => (
                      <label
                        key={testType.id}
                        className="flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-150 ease-in-out"
                        style={{
                          borderColor: `${category.color}20`,
                          backgroundColor: 'white'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = getCategoryBackground(category.color).replace('0.03', '0.08');
                          e.currentTarget.style.borderColor = `${category.color}40`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = `${category.color}20`;
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTests.includes(testType.id)}
                          onChange={() => toggleTestType(testType.id)}
                          className="w-4 h-4 border-gray-300 rounded focus:ring-2 transition-all"
                          style={{
                            accentColor: category.color
                          }}
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{testType.name}</span>
                            <span 
                              className="text-sm font-semibold"
                              style={{ color: category.color }}
                            >
                              {testType.price.toLocaleString('hu-HU')} Ft
                            </span>
                          </div>
                          {testType.description && (
                            <p className="text-sm text-gray-500 mt-1">{testType.description}</p>
                          )}
                          {testType.turnaround_days !== null && testType.turnaround_days !== undefined && (
                            <p className="text-xs text-gray-400 mt-1">
                              Átfutási idő: {testType.turnaround_days} nap
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Uncategorized tests */}
          {testTypes.filter(tt => !tt.category_id && tt.is_active).length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-600 mb-3 pb-2 border-b border-gray-300">
                Egyéb vizsgálatok
              </h3>
              <div className="space-y-2">
                {testTypes.filter(tt => !tt.category_id && tt.is_active).map((testType) => (
                  <label
                    key={testType.id}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(testType.id)}
                      onChange={() => toggleTestType(testType.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{testType.name}</span>
                        <span className="text-sm font-semibold text-indigo-600">
                          {testType.price.toLocaleString('hu-HU')} Ft
                        </span>
                      </div>
                      {testType.description && (
                        <p className="text-sm text-gray-500 mt-1">{testType.description}</p>
                      )}
                      {testType.turnaround_days && (
                        <p className="text-xs text-gray-400 mt-1">
                          Átfutási idő: {testType.turnaround_days} nap
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedTests.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-indigo-900">Összesen:</span>
              <span className="text-lg font-bold text-indigo-600">
                {calculateTotalPrice().toLocaleString('hu-HU')} Ft
              </span>
            </div>
          )}
        </div>

        {/* Special Instructions */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Speciális utasítások
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              További megjegyzések (opcionális)
            </label>
            <textarea
              value={formData.special_instructions}
              onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Speciális kezelési utasítások, kérések..."
            />
          </div>
        </div>

        {/* File Attachment */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-indigo-600" />
            Melléklet
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fájl csatolása (opcionális, max 20 MB)
            </label>
            
            {existingAttachment && !attachmentFile && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Paperclip className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">Meglévő: {existingAttachment}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Törölni akarod a meglévő mellékletet?')) {
                      setExistingAttachment('');
                    }
                  }}
                  className="ml-auto text-red-600 hover:text-red-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
                <Paperclip className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-700">Fájl kiválasztása</span>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size > 20 * 1024 * 1024) {
                      alert('A fájl mérete nem lehet nagyobb 20 MB-nál!');
                      e.target.value = '';
                      return;
                    }
                    setAttachmentFile(file);
                  }}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
              </label>
              
              {attachmentFile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
                  <Paperclip className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-indigo-700">{attachmentFile.name}</span>
                  <span className="text-xs text-indigo-500">
                    ({(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachmentFile(null)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Támogatott: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (max 20 MB)
            </p>
          </div>
        </div>

        {/* v6.4 - Sticky Action Bar */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/requests')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Mégse
            </button>
            
            <button
              type="button"
              onClick={saveDraft}
              className="flex items-center gap-2 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Save className="w-5 h-5" />
              Mentés piszkozatként
            </button>
            
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-5 h-5" />
              {originalStatus === 'rejected' 
                ? 'Mentés (Elutasított)' 
                : (user?.role === 'company_admin' ? 'Beküldés' : 'Beküldés jóváhagyásra')
              }
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default RequestForm;
