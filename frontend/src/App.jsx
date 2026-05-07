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
  X
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

  useEffect(() => {
    fetchData();
  }, [searchQuery, filterType, filterStatus]);

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

  const fetchData = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_BASE_URL}/upload`, formData);
      fetchData(); // Refresh dashboard
    } catch (error) {
      alert('Upload failed: ' + error.message);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0c10] text-[#f8fafc] font-sans selection:bg-white/10">
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
            onClick={() => setActiveTab('Dashboard')}
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
            <h2 className="text-xl font-bold tracking-tight">OpenAudit AI Dashboard</h2>
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
              <StatCard label="Total docs" value={stats.total} subValue={`${stats.today} today`} icon={<FileText size={16} />} color="white" />
              <StatCard label="Death cases" value={stats.death} subValue={`${Math.round((stats.death / (stats.total || 1)) * 100)}% of total`} icon={<AlertCircle size={16} />} color="red" />
              <StatCard label="Disability" value={stats.disability} subValue={`${Math.round((stats.disability / (stats.total || 1)) * 100)}% of total`} icon={<Activity size={16} />} color="orange" />
              <StatCard label="Hospitalisation" value={stats.hospitalisation} subValue={`${Math.round((stats.hospitalisation / (stats.total || 1)) * 100)}% of total`} icon={<Activity size={16} />} color="blue" />
              <StatCard label="Needs review" value={stats.needs_review} subValue="Low confidence" icon={<AlertCircle size={16} />} color="amber" />
              <StatCard label="Duplicates" value={stats.duplicates} subValue="Flagged" icon={<Copy size={16} />} color="slate" />
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
                    {loading && documents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-24 text-center">
                          <Loader2 className="animate-spin text-white mx-auto mb-4" size={32} />
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Syncing database...</p>
                        </td>
                      </tr>
                    ) : (
                      documents
                        .filter(doc => activeTab !== 'Reviews' || (doc.analysis_result?.classification?.confidence || 1) < 0.6)
                        .map((doc) => (
                          <tr key={doc.id} className="hover:bg-white/[0.02] transition-all group">
                            <td className="px-8 py-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-tight">{doc.id}</span>
                                <span className="text-[11px] font-medium text-slate-500 mt-1">
                                  {doc.filename} · {new Date(doc.created_at).toLocaleDateString()}
                                  {duplicateIds.includes(doc.id) && (
                                    <span className="ml-3 px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[8px] uppercase font-black">Duplicate</span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <Badge type={doc.analysis_result?.classification?.category || 'Unknown'} />
                            </td>
                            <td className="px-6 py-6 text-center">
                              <span className={cn(
                                "font-bold text-sm",
                                (doc.analysis_result?.classification?.confidence || 1) < 0.6 ? "text-red-500" : "text-slate-300"
                              )}>
                                {Math.round((doc.analysis_result?.classification?.confidence || 0) * 100)}%
                              </span>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <ValidationBadge isValid={doc.analysis_result?.validation?.is_valid} errorCount={doc.analysis_result?.validation?.errors?.length || 0} />
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button onClick={() => handleSelectDoc(doc.id)} className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all bg-white/5 px-4 py-2 rounded-xl">View ↗</button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-6 border-t border-white/5 bg-white/[0.01] flex justify-between items-center shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{documents.length} Records synchronized</p>
                <div className="flex gap-4">
                  <ActionButton icon={<Download size={16} />} label="Export CSV" />
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
               <button 
                onClick={() => setSelectedDoc(null)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
               >
                <X size={20} />
               </button>
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
                               {selectedDoc.analysis_result?.validation?.errors?.join(', ') || 'Validation errors detected.'}
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

function StatCard({ label, value, subValue, icon, color }) {
  const colorStyles = {
    red: "text-red-500 border-red-500/20 bg-red-500/[0.02]",
    blue: "text-blue-500 border-blue-500/20 bg-blue-500/[0.02]",
    orange: "text-orange-500 border-orange-500/20 bg-orange-500/[0.02]",
    amber: "text-amber-500 border-amber-500/20 bg-amber-500/[0.02]",
    white: "text-white border-white/10 bg-white/[0.02]",
    slate: "text-slate-500 border-white/5 bg-white/[0.01]"
  };

  const textColors = {
    red: "text-red-500",
    blue: "text-blue-500",
    orange: "text-orange-500",
    amber: "text-amber-500",
    white: "text-white",
    slate: "text-slate-500"
  };

  return (
    <div className={cn(
      "p-6 rounded-[10px] border transition-all hover:scale-[1.02] relative group overflow-hidden",
      colorStyles[color]
    )}>
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
