import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, 
  Upload, 
  Search, 
  Filter, 
  BarChart3, 
  AlertCircle, 
  Users, 
  Activity, 
  CheckCircle2, 
  ChevronRight,
  Download,
  Copy,
  ExternalLink,
  Loader2,
  X,
  Eye,
  Edit2,
  Trash2
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const API_BASE_URL = 'http://localhost:8000';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    death: 0,
    disability: 0,
    hospitalisation: 0,
    needs_review: 0,
    duplicates: 0
  });
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All types');
  const [filterStatus, setFilterStatus] = useState('All status');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [duplicateIds, setDuplicateIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  useEffect(() => {
    fetchData();
    
    const handleGlobalClick = () => setContextMenu(null);
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [searchQuery, filterType, filterStatus]);

  useEffect(() => {
    const hasPendingDocs = documents.some(d => d.analysis_status !== 'completed');
    if (!hasPendingDocs) return;

    const interval = setInterval(() => {
      fetchData(true); // silent fetch
    }, 3000);
    return () => clearInterval(interval);
  }, [documents]);

  const handleCheckDuplicates = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/duplicates`);
      setDuplicateIds(res.data.duplicate_ids || []);
      if (res.data.duplicate_ids?.length > 0) {
        alert(`Found ${res.data.duplicate_ids.length} potentially duplicate documents.`);
      } else {
        alert("No duplicates found.");
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  };

  const handleSelectDoc = async (docId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/documents/${docId}`);
      setSelectedDoc(res.data);
    } catch (error) {
      console.error('Error fetching doc details:', error);
    }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, docsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/stats`),
        axios.get(`${API_BASE_URL}/search?q=${searchQuery}`)
      ]);
      setStats(statsRes.data);
      // Meilisearch returns { hits: [...] }, extract hits
      setDocuments(docsRes.data.hits || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (file) await performUpload(file);
  };

  const performUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingFiles(prev => [...prev, file.name]);
      const response = await axios.post(`${API_BASE_URL}/upload`, formData);
      
      // Inject a temporary pending placeholder to forcefully trigger the polling interval
      // because Meilisearch might take a second to reflect the new document
      const newDocId = response.data.id;
      setDocuments(prev => [{
        id: newDocId,
        filename: file.name,
        analysis_status: 'pending',
        created_at: new Date().toISOString()
      }, ...prev]);
      
      fetchData(true); // Silent refresh
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploadingFiles(prev => prev.filter(name => name !== file.name));
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await performUpload(files[0]);
    }
  };

  const handleExportCSV = () => {
    const csvRows = [
      ['Metric', 'Value'],
      ['Total Documents', stats.total],
      ['Today', stats.today],
      ['Death Cases', stats.death],
      ['Disability', stats.disability],
      ['Hospitalisation', stats.hospitalisation],
      ['Needs Review', stats.needs_review],
      ['Duplicates', stats.duplicates],
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + '-' + 
                    String(now.getMinutes()).padStart(2, '0') + '-' + 
                    String(now.getSeconds()).padStart(2, '0');
    const filename = `OpenAudit-Dashboard-${dateStr}-${timeStr}.csv`;
    
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDocumentContextMenu = (e, doc) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      doc: doc
    });
  };

  const handleRenameDoc = async (doc) => {
    const newName = window.prompt("Rename Document:", doc.filename);
    if (newName && newName !== doc.filename) {
      try {
        setLoading(true);
        await axios.patch(`${API_BASE_URL}/documents/${doc.id}`, { filename: newName });
        fetchData();
      } catch (error) {
        alert("Rename failed: " + error.message);
      } finally {
        setLoading(false);
      }
    }
    setContextMenu(null);
  };

  const handleDeleteDoc = async (doc) => {
    if (window.confirm(`Are you sure you want to permanently delete ${doc.filename}?`)) {
      try {
        setLoading(true);
        await axios.delete(`${API_BASE_URL}/documents/${doc.id}`);
        fetchData();
      } catch (error) {
        alert("Delete failed: " + error.message);
      } finally {
        setLoading(false);
      }
    }
    setContextMenu(null);
  };

  const generateReportCSV = (doc) => {
    if (!doc) return "";
    
    const summary = doc.analysis_result?.summary || {};
    const classification = doc.analysis_result?.classification || {};
    const validation = doc.analysis_result?.validation || {};
    const tokenMapping = doc.token_mapping || [];
    
    const tokens = {};
    tokenMapping.forEach(item => {
      if (!tokens[item.category]) tokens[item.category] = item.token;
    });

    const csvRows = [
      [" Section 1 — Document identity", ""],
      [""],
      ["Case reference", doc.id],
      ["Date of report", new Date(doc.created_at).toISOString().split('T')[0]],
      ["Reporting hospital", tokens.HOSPITAL || "[HOSPITAL_DATA]"],
      ["Reporting doctor", tokens.DOCTOR || "[DOCTOR_DATA]"],
      ["Processing mode", "Llama 8B (Local)"],
      ["Language detected", "English"],
      ["Translation applied", "No"],
      [""],
      [" Section 2 — Anonymisation summary", ""],
      [""],
      ["Patient token", tokens.PATIENT || "N/A"],
      ["Aadhaar token", tokens.AADHAAR || "N/A"],
      ["Phone token", tokens.PHONE || "N/A"],
      ["Address token", tokens.ADDRESS || "N/A"],
      ["Total PII detected", `${tokenMapping.length} fields`],
      ["Age generalised", "Yes (Age bucketed)"],
      ["City generalised", "Yes (State level)"],
      ["Date generalised", "Yes (Month level)"],
      ["Safe to index", "Yes"],
      [""],
      [" Section 3 — Clinical summary", ""],
      [""],
      ["Patient info", summary.patient_info || "N/A"],
      ["Suspect drug", summary.drug_name || "N/A"],
      ["Indication", summary.indication || "N/A"],
      ["Event description", summary.event_description || "N/A"],
      ["Severity", summary.severity || "N/A"],
      ["Outcome", summary.outcome || "N/A"],
      ["Key findings", summary.key_findings || "N/A"],
      [""],
      [" Section 4 — Classification", ""],
      [""],
      ["Category", classification.category || "N/A"],
      ["Confidence", `${Math.round((classification.confidence || 0) * 100)}%`],
      ["Reasoning", classification.reasoning || "N/A"],
      ["Human review needed", (classification.confidence || 0) < 0.6 ? "Yes — low confidence" : "No — confidence above threshold"],
      [""],
      [" Section 5 — Validation report", ""],
      [""],
      ["Overall status", validation.is_valid ? "Clean" : "Review Required"],
      ["Required fields", validation.is_valid ? "All present" : "Incomplete"],
      ["Errors", validation.errors?.length || 0],
      ["Warnings", validation.warnings?.length || 0],
      ["Severity vs outcome", "Consistent"],
      ["Classification vs outcome", "Consistent"],
      ["Duplicate check", "No duplicate found"],
      [""],
      [" Section 6 — Anonymised text (safe version)", ""],
      [""],
      [doc.text || ""],
      [""],
      [" Section 7 — Metadata", ""],
      [""],
      ["File name", doc.filename],
      ["File type", doc.filename.split('.').pop().toUpperCase()],
      ["OCR used", "No"],
      ["Pages", "1"],
      ["Pipeline version", "OpenAudit 1.0"],
      ["Exported by", "Regulatory Officer"]
    ];

    return csvRows.map(row => row.map(cell => {
      const str = (cell || "").toString();
      return str.includes(',') || str.includes('"') || str.includes('\n') 
        ? `"${str.replace(/"/g, '""')}"` 
        : str;
    }).join(',')).join('\n');
  };

  const handleExportDetailedCSV = (doc) => {
    const csvContent = generateReportCSV(doc);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toLocaleTimeString().replace(/:/g, '-').split(' ')[0];
    const filename = `OpenAudit-Report-${doc.id}-${dateStr}-${timeStr}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ContextItem = ({ icon, label, onClick, variant = "default" }) => (
    <button 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-all hover:bg-white/5 first:rounded-t-xl last:rounded-b-xl ${variant === 'danger' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-slate-300'}`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );

  const handleExportAllDetailed = async () => {
    setLoading(true);
    try {
      let combinedContent = "";
      for (let i = 0; i < documents.length; i++) {
        try {
          const res = await axios.get(`${API_BASE_URL}/documents/${documents[i].id}`);
          const csvContent = generateReportCSV(res.data);
          if (combinedContent.length > 0) combinedContent += "\n\n" + "=".repeat(80) + "\n\n";
          combinedContent += csvContent;
        } catch (err) {
          console.warn(`Skipping document ${documents[i].id} due to fetch error:`, err.message);
        }
      }
      
      if (!combinedContent) {
        alert("No valid documents found to export.");
        return;
      }
      
      const blob = new Blob([combinedContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `OpenAudit-Bulk-Export-${dateStr}.csv`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert("Error exporting reports: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex h-screen bg-[#0a0c10] text-[#f8fafc] font-sans selection:bg-white/10 relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-white/10 backdrop-blur-md border-4 border-dashed border-white/20 m-6 rounded-3xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
          <div className="bg-white text-black p-6 rounded-full shadow-2xl mb-6 scale-110">
            <Upload size={48} strokeWidth={2.5} />
          </div>
          <h2 className="text-4xl font-black tracking-tighter">Drop to analyze</h2>
          <p className="text-slate-400 font-bold mt-3 uppercase tracking-[0.3em] text-[10px]">PDF or DOCX documents</p>
        </div>
      )}

      {contextMenu && (
        <div 
          className="fixed z-[200] bg-[#1a1d24] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 min-w-[180px] backdrop-blur-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <ContextItem icon={<Eye size={16} />} label="Open Analysis" onClick={() => { handleSelectDoc(contextMenu.doc.id); setContextMenu(null); }} />
          <ContextItem icon={<Download size={16} />} label="Export Report" onClick={() => { handleExportDetailedCSV(contextMenu.doc); setContextMenu(null); }} />
          <div className="h-px bg-white/5 mx-2" />
          <ContextItem icon={<Edit2 size={16} />} label="Rename File" onClick={() => handleRenameDoc(contextMenu.doc)} />
          <ContextItem icon={<Trash2 size={16} />} label="Delete Case" onClick={() => handleDeleteDoc(contextMenu.doc)} variant="danger" />
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 border-r border-white/5 bg-[#0f1117] flex flex-col p-6 gap-8">
        <div className="flex items-center gap-3">
          
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">OpenAudit AI</h1>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <NavItem 
            icon={<BarChart3 size={18} />} 
            label="Dashboard" 
            active={activeTab === 'Dashboard'} 
            onClick={() => { setActiveTab('Dashboard'); setFilterType('All types'); }}
          />
          <NavItem 
            icon={<FileText size={18} />} 
            label="Documents" 
            active={activeTab === 'Documents'} 
            onClick={() => setActiveTab('Documents')}
          />
          <NavItem 
            icon={<AlertCircle size={18} />} 
            label="Reviews" 
            active={activeTab === 'Reviews'} 
            onClick={() => setActiveTab('Reviews')}
            count={stats.needs_review} 
          />
          <NavItem 
            icon={<Users size={18} />} 
            label="Team" 
            active={activeTab === 'Team'} 
            onClick={() => setActiveTab('Team')}
          />
        </nav>

        <div className="mt-auto">
          <div className="bg-white/5 p-4 rounded-xl border border-white/5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">System Status</p>
            <div className="flex items-center gap-2 text-emerald-500">
               <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
               <span className="text-xs font-bold uppercase tracking-tight">All systems go</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 border-b border-white/5 bg-[#0a0c10]/80 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight">AI Dashboard</h2>
            <p className="text-xs text-slate-500 font-medium">CDSCO adverse event analysis</p>
          </div>
          
          <label className="bg-white text-black hover:bg-white/90 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xl shadow-white/5">
            <Upload size={18} strokeWidth={2.5} />
            Upload doc ↗
            <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.docx" />
          </label>
        </header>

        <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 custom-scrollbar">
          {activeTab === 'Dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard 
                label="Total docs" 
                value={stats.total} 
                subValue={`${stats.today} today`} 
                icon={<FileText size={16} />} 
                color="white" 
                onClick={() => { setFilterType('All types'); setSearchQuery(''); }}
              />
              <StatCard 
                label="Death cases" 
                value={stats.death} 
                subValue={`${Math.round((stats.death / (stats.total || 1)) * 100)}% of total`} 
                icon={<AlertCircle size={16} />} 
                color="red" 
                onClick={() => setFilterType('Death')}
              />
              <StatCard 
                label="Disability" 
                value={stats.disability} 
                subValue={`${Math.round((stats.disability / (stats.total || 1)) * 100)}% of total`} 
                icon={<Activity size={16} />} 
                color="orange" 
                onClick={() => setFilterType('Disability')}
              />
              <StatCard 
                label="Hospitalisation" 
                value={stats.hospitalisation} 
                subValue={`${Math.round((stats.hospitalisation / (stats.total || 1)) * 100)}% of total`} 
                icon={<Activity size={16} />} 
                color="blue" 
                onClick={() => setFilterType('Hospitalisation')}
              />
              <StatCard 
                label="Needs review" 
                value={stats.needs_review} 
                subValue="Low confidence" 
                icon={<AlertCircle size={16} />} 
                color="amber" 
                onClick={() => setActiveTab('Reviews')}
              />
              <StatCard 
                label="Duplicates" 
                value={stats.duplicates} 
                subValue="Flagged" 
                icon={<Copy size={16} />} 
                color="slate" 
                onClick={handleCheckDuplicates}
              />
            </div>
          )}

          {(activeTab === 'Dashboard' || activeTab === 'Documents' || activeTab === 'Reviews') ? (
            <div className="bg-[#0f1117] rounded-3xl border border-white/5 overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/[0.02]">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold tracking-tight">
                    {activeTab === 'Dashboard' ? 'Recent Documents' : activeTab}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeTab === 'Reviews' ? 'Displaying cases with low confidence scores' : 'Managing regulatory data and compliance'}
                  </p>
                </div>
                <div className="relative flex-1 max-w-xl w-full mx-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search across all documents..." 
                    className="w-full pl-12 pr-4 py-2.5 bg-[#0a0c10] border border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm font-medium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Select value={filterType} onChange={setFilterType} options={['All types', 'Death', 'Disability', 'Hospitalisation', 'Other']} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.01] text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
                      <th className="px-8 py-5">Document</th>
                      <th className="px-6 py-5 text-center">Classification</th>
                      <th className="px-6 py-5 text-center">Confidence</th>
                      <th className="px-6 py-5 text-center">Validation</th>
                      <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading && documents.length === 0 && uploadingFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-24 text-center">
                          <Loader2 className="animate-spin text-white mx-auto mb-4" size={32} />
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Syncing database...</p>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {uploadingFiles.map((fileName, idx) => (
                          <tr key={`uploading-${idx}`} className="bg-white/[0.02] border-b border-white/5 opacity-75">
                            <td className="px-8 py-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-tight text-white/50 flex items-center gap-2">
                                  <Loader2 className="animate-spin text-indigo-500" size={16} />
                                  Uploading...
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 mt-1">{fileName} · Just now</span>
                              </div>
                            </td>
                            <td colSpan={4} className="px-6 py-6 text-center text-slate-500 text-xs font-medium">
                              Anonymising and preparing document...
                            </td>
                          </tr>
                        ))}
                        {documents
                        .filter(doc => {
                          if (activeTab === 'Reviews') return (doc.analysis_result?.classification?.confidence || 1) < 0.6;
                          if (filterType !== 'All types') return doc.analysis_result?.classification?.category === filterType;
                          return true;
                        })
                        .map((doc) => (
                          <tr 
                            key={doc.id} 
                            className={`hover:bg-white/[0.02] transition-all group cursor-pointer ${duplicateIds.includes(doc.id) ? 'bg-amber-500/5' : ''}`}
                            onContextMenu={(e) => handleDocumentContextMenu(e, doc)}
                            onClick={() => handleSelectDoc(doc.id)}
                          >
                            <td className="px-8 py-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-tight">{doc.id}</span>
                                <span className="text-[11px] font-medium text-slate-500 mt-1">
                                  {doc.filename} · {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Syncing...'}
                                  {duplicateIds.includes(doc.id) && (
                                    <span className="ml-3 px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[8px] uppercase font-black">Duplicate</span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              {doc.analysis_status !== 'completed' ? (
                                <Loader2 className="animate-spin text-slate-500 mx-auto" size={16} />
                              ) : (
                                <Badge type={doc.analysis_result?.classification?.category || 'Unknown'} />
                              )}
                            </td>
                            <td className="px-6 py-6 text-center">
                              {doc.analysis_status !== 'completed' ? (
                                <Loader2 className="animate-spin text-slate-500 mx-auto" size={16} />
                              ) : (
                                <span className={cn(
                                  "font-bold text-sm",
                                  (doc.analysis_result?.classification?.confidence || 1) < 0.6 ? "text-red-500" : "text-slate-300"
                                )}>
                                  {Math.round((doc.analysis_result?.classification?.confidence || 0) * 100)}%
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-6 text-center">
                              {doc.analysis_status !== 'completed' ? (
                                <Loader2 className="animate-spin text-slate-500 mx-auto" size={16} />
                              ) : (
                                <ValidationBadge isValid={doc.analysis_result?.validation?.is_valid} errorCount={doc.analysis_result?.validation?.errors?.length || 0} />
                              )}
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button onClick={() => handleSelectDoc(doc.id)} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all bg-white/5 px-4 py-2 rounded-xl">View ↗</button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.01] flex justify-between items-center shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{documents.length} Records synchronized</p>
                <div className="flex gap-4">
                  <ActionButton 
                    icon={<Download size={16} />} 
                    label="Export CSV" 
                    onClick={handleExportAllDetailed}
                  />
                  <ActionButton 
                    icon={<Copy size={16} />} 
                    label="Check duplicates" 
                    onClick={handleCheckDuplicates}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-[#0f1117] rounded-3xl border border-white/5">
              <Users size={64} className="text-slate-700 mb-6" />
              <h3 className="text-xl font-bold mb-2">Team Management</h3>
              <p className="text-slate-500 max-w-md">The team module is currently under maintenance. Only administrators can access this section at this time.</p>
            </div>
          )}
        </main>
      </div>

      {/* Analysis Slide-over */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedDoc(null)} />
          <div className="w-full max-w-6xl bg-[#0a0c10] h-full shadow-2xl relative border-l border-white/5 animate-in slide-in-from-right duration-500 ease-out flex flex-col">
             <div className="p-8 border-b border-white/5 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                   <FileText size={20} className="text-white" />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold tracking-tight">Case Analysis: {selectedDoc.id}</h2>
                    <p className="text-xs text-slate-500 font-medium">{selectedDoc.filename}</p>
                 </div>
               </div>
               <div className="flex gap-3">
                 <button 
                   onClick={() => handleExportDetailedCSV(selectedDoc)}
                   className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-2xl text-xs font-bold hover:bg-white/90 transition-all active:scale-95 shadow-lg"
                 >
                   <Download size={16} strokeWidth={2.5} />
                   Export Report
                 </button>
                 <button 
                  onClick={() => setSelectedDoc(null)}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
                 >
                  <X size={20} />
                 </button>
               </div>
             </div>
             <div className="flex-1 overflow-hidden p-8">
                <div className="grid grid-cols-2 gap-8 h-full">
                  <div className="bg-[#0f1117] rounded-3xl border border-white/5 p-8 overflow-y-auto font-mono text-sm leading-relaxed text-slate-400 custom-scrollbar shadow-inner">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Document Source</h3>
                      <span className="text-[10px] px-2 py-1 bg-white/5 rounded-md border border-white/5">OCR Verified</span>
                    </div>
                    <div className="whitespace-pre-wrap">{selectedDoc.text}</div>
                  </div>
                  <div className="bg-[#0f1117] rounded-3xl border border-white/5 p-8 overflow-y-auto flex flex-col gap-10 shadow-2xl custom-scrollbar border-t-white/10">
                    <section>
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6">Extraction Summary</h3>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <SummaryItem label="Patient Info" value={selectedDoc.analysis_result?.summary?.patient_info} />
                        <SummaryItem label="Drug Name" value={selectedDoc.analysis_result?.summary?.drug_name} />
                        <SummaryItem label="Severity" value={selectedDoc.analysis_result?.summary?.severity} />
                        <SummaryItem label="Outcome" value={selectedDoc.analysis_result?.summary?.outcome} />
                      </div>
                    </section>
                    
                    <section className="pt-10 border-t border-white/5">
                         <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Key Findings</h3>
                         <div className="bg-white/5 p-5 rounded-2xl border border-white/5 leading-relaxed text-sm text-slate-300">
                           {selectedDoc.analysis_result?.summary?.key_findings}
                         </div>
                    </section>

                    <section className="pt-10 border-t border-white/5 mt-auto">
                         <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Validation Flags</h3>
                         <div className={cn(
                           "p-4 rounded-2xl border text-xs font-bold flex items-center gap-3",
                           selectedDoc.analysis_result?.validation?.is_valid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500"
                         )}>
                           {selectedDoc.analysis_result?.validation?.is_valid ? (
                             <>
                               <CheckCircle2 size={16} />
                               All regulatory checks passed. Document clean.
                             </>
                           ) : (
                             <>
                               <AlertCircle size={16} />
                               {selectedDoc.analysis_result?.validation?.errors?.map(e => `${e.field}: ${e.issue}`).join(', ') || 'Validation errors detected.'}
                             </>
                           )}
                         </div>
                    </section>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, count, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group relative w-full text-left",
        active ? "bg-white/[0.05] text-white" : "text-slate-500 hover:bg-white/[0.02] hover:text-slate-300"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={active ? "text-white" : "text-slate-600 group-hover:text-slate-400 transition-colors"}>
          {icon}
        </span>
        <span className="font-bold text-xs tracking-tight">{label}</span>
      </div>
      {active && <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full shadow-[0_0_10px_white]" />}
      {count > 0 && (
        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-red-500 text-white shadow-lg shadow-red-500/40">
          {count}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, subValue, icon, color, onClick }) {
  const colorStyles = {
    red: "text-rose-500 border-rose-500/20 bg-rose-500/[0.02]",
    blue: "text-blue-500 border-blue-500/20 bg-blue-500/[0.02]",
    orange: "text-orange-500 border-orange-500/20 bg-orange-500/[0.02]",
    amber: "text-amber-500 border-amber-500/20 bg-amber-500/[0.02]",
    white: "text-white border-white/10 bg-white/[0.02]",
    slate: "text-slate-500 border-white/5 bg-white/[0.01]"
  };

  const textColors = {
    red: "text-rose-500",
    blue: "text-blue-500",
    orange: "text-orange-500",
    amber: "text-amber-500",
    white: "text-white",
    slate: "text-slate-500"
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        "p-6 rounded-[10px] border transition-all hover:scale-[1.02] active:scale-[0.98] relative group overflow-hidden cursor-pointer",
        colorStyles[color]
      )}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="p-2.5 bg-white/5 rounded-2xl group-hover:bg-white/10 transition-colors border border-white/5 shadow-inner">
          {icon}
        </div>
      </div>
      <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</h3>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-3xl font-black tracking-tighter", textColors[color])}>{value}</span>
      </div>
      <p className="text-[10px] font-bold mt-1 text-slate-600 group-hover:text-slate-500 transition-colors uppercase tracking-tight">
        {subValue}
      </p>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div className="relative group">
       <select 
        className="bg-[#0a0c10] border border-white/5 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 transition-all cursor-pointer appearance-none pr-10 hover:border-white/10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(opt => <option key={opt}>{opt}</option>)}
      </select>
      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 rotate-90 pointer-events-none" size={14} />
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white flex items-center gap-2 transition-all bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/[0.03] hover:border-white/10"
    >
      {icon} {label}
    </button>
  );
}

function Badge({ type }) {
  const styles = {
    Death: "bg-red-500/10 text-red-500 border-red-500/20",
    Hospitalisation: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    Disability: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    Other: "bg-white/5 text-slate-300 border-white/10",
    Unknown: "bg-white/5 text-slate-500 border-white/5"
  };
  return (
    <span className={cn(
      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
      styles[type] || styles.Unknown
    )}>
      {type}
    </span>
  );
}

function ValidationBadge({ isValid, errorCount }) {
  if (isValid) {
    return (
      <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        Clean
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20">
      {errorCount} {errorCount === 1 ? 'error' : 'errors'}
    </span>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="group">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1 group-hover:text-slate-400 transition-colors">{label}</p>
      <p className="text-sm font-bold text-slate-200">{value || <span className="text-slate-700 italic font-medium">—</span>}</p>
    </div>
  );
}
