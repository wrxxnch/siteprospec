import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Settings, 
  MapPin, 
  Phone, 
  Star, 
  CheckCircle2, 
  MessageCircle, 
  ArrowRight, 
  Copy, 
  Layout, 
  Send,
  Building2,
  Trash2,
  Download,
  Image as ImageIcon,
  Clock,
  Zap,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

// --- Types ---
interface BusinessData {
  name: string;
  address: string;
  city: string;
  state: string;
  whatsapp: string;
  services: string[];
  hours: string;
  rating: number;
  reviews: number;
  differential: string;
  promotion: string;
  thumbnail: string;
}

interface UserSettings {
  serpApiKey: string;
  imageApi: 'picsum' | 'unsplash' | 'gemini';
  promptTemplate: string;
}

const NICHES = [
  "Odontologia",
  "Estética e Beleza",
  "Fisioterapia",
  "Psicologia",
  "Barbearia",
  "Restaurante",
  "Advocacia",
  "Contabilidade",
  "Pet Shop/Vet",
  "Academia"
];

const NICHE_IMAGE_KEYWORDS: Record<string, string> = {
  "Odontologia": "dentist,clinic,surgery",
  "Estética e Beleza": "skincare,spa,aesthetic",
  "Fisioterapia": "physiotherapy,massage,wellness",
  "Psicologia": "therapy,consulting,cozy",
  "Barbearia": "barber,grooming,beard",
  "Restaurante": "gourmet,food,restaurant",
  "Advocacia": "lawyer,office,legal",
  "Contabilidade": "office,business,finance",
  "Pet Shop/Vet": "vet,dog,cat,clinic",
  "Academia": "fitness,gym,workout"
};

const COLORS = {
  nude: "#1a1817",
  rose: "#141211",
  gold: "#d4af37",
  dark: "#e5e1df",
  muted: "#8c827c",
  border: "#3d3632",
  light: "#FFFFFF"
};

// --- Helper: Format Prompt ---
const formatPrompt = (data: BusinessData) => {
  return `Nome do negócio: ${data.name}
Cidade: ${data.city} - ${data.state}
WhatsApp: ${data.whatsapp}
Tratamentos e Serviços: ${data.services.length > 0 ? data.services.join(', ') : '[AGUARDANDO IA]'}
Promoção atual: ${data.promotion || '[AGUARDANDO IA]'}
Horário: ${data.hours}
Diferencial: ${data.differential}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'search' | 'editor' | 'preview' | 'settings'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessData | null>(null);
  const [niche, setNiche] = useState(NICHES[0]);
  const [settings, setSettings] = useState<UserSettings>({
    serpApiKey: '',
    imageApi: 'picsum',
    promptTemplate: `Com base nestas informações da empresa:
{{BUSINESS_INFO}}

Crie uma lista de 5 serviços detalhados e um parágrafo de "Diferencial" atraente para o nicho {{NICHE}}. 

IMPORTANTE: Responda APENAS com um objeto JSON válido, sem texto antes ou depois.
Formato: { "services": ["serviço 1", ...], "differential": "texto", "promotion": "texto se houver" }`
  });

  const [aiResponse, setAiResponse] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('metabusiness_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(prev => ({
        ...prev,
        ...parsed
      }));
    }
  }, []);

  const saveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    localStorage.setItem('metabusiness_settings', JSON.stringify(newSettings));
    setActiveTab('search');
  };

  const handleSearch = async () => {
    if (!settings.serpApiKey) {
      // We don't block here if settings.serpApiKey is empty because 
      // the server might have SERPAPI_KEY in its environment.
      // We only alert if we want to force the user to provide one.
      // But let's let the backend handle the missing key error if both are missing.
    }
    setLoading(true);
    try {
      const response = await axios.get('/api/search-maps', {
        params: { 
          query: searchQuery,
          apiKey: settings.serpApiKey 
        }
      });
      setResults(response.data.place_results || response.data.local_results || []);
    } catch (err) {
      console.error(err);
      alert("Erro ao buscar no Maps.");
    } finally {
      setLoading(false);
    }
  };

  const selectBusiness = (item: any) => {
    const addressParts = (item.address || '').split(',');
    const cityState = addressParts.length > 1 ? addressParts[addressParts.length - 2].trim() : 'Cidade';
    
    setSelectedBusiness({
      name: item.title,
      address: item.address || '',
      city: cityState,
      state: '',
      whatsapp: item.phone || '',
      services: [],
      hours: item.operating_hours?.description || 'Horário comercial',
      rating: item.rating || 0,
      reviews: item.reviews || 0,
      differential: 'Atendimento exclusivo e alto padrão.',
      promotion: '',
      thumbnail: item.thumbnail || ''
    });
    setActiveTab('editor');
  };

  const sendToAI = async () => {
    if (!selectedBusiness) return;

    setIsGenerating(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const template = String(settings.promptTemplate || '');
      const businessInfo = formatPrompt(selectedBusiness);
      const nicheSafe = String(niche || '');

      const prompt = template
        .replace('{{BUSINESS_INFO}}', businessInfo)
        .replace('{{NICHE}}', nicheSafe);
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      const text = response.text;
      if (!text) {
        throw new Error("O Gemini não retornou nenhum texto.");
      }
      
      // Robust JSON extraction
      let cleanJson = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      }
      
      const data = JSON.parse(cleanJson);
      
      setSelectedBusiness(prev => prev ? {
        ...prev,
        services: Array.isArray(data.services) ? data.services : prev.services,
        differential: typeof data.differential === 'string' ? data.differential : prev.differential,
        promotion: typeof data.promotion === 'string' ? data.promotion : prev.promotion
      } : null);
      
      setActiveTab('preview');
    } catch (err: any) {
      console.error('AI Error:', err);
      let errorMessage = "Erro ao processar com IA. Verifique as configurações.";
      
      if (err.message && (err.message.includes('API key not valid') || err.message.includes('API_KEY_INVALID'))) {
        errorMessage = "Chave API do Gemini inválida ou não configurada corretamente na plataforma.";
      } else if (err.message) {
        errorMessage = `Erro: ${err.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSingleHTML = () => {
    if (!selectedBusiness) return;
    
    const html = generateHTMLInternal(selectedBusiness, niche);
    
    const element = document.createElement('a');
    const file = new Blob([html], {type: 'text/html'});
    element.href = URL.createObjectURL(file);
    element.download = `${(selectedBusiness.name || 'landing').toLowerCase().replace(/\s+/g, '-')}-landing.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen font-sans transition-colors duration-500" style={{ backgroundColor: COLORS.nude, color: COLORS.dark }}>
      {/* Navigation */}
      <nav className="bg-[#141211] border-b border-[#3d3632] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#d4af37] flex items-center justify-center shadow-lg transform rotate-3">
              <Zap className="text-[#141211] w-6 h-6" />
            </div>
            <div>
              <span className="font-serif text-xl font-bold tracking-[0.2em] uppercase text-[#d4af37] block leading-none">Scraper.AI</span>
              <span className="text-[10px] text-[#8c827c] tracking-widest uppercase mt-1">Sophisticated Builder Shell</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-1 bg-[#1a1817] p-1 rounded-lg border border-[#3d3632]">
            {[
              { id: 'search', icon: Search, label: 'Search' },
              { id: 'editor', icon: Layout, label: 'Prompt' },
              { id: 'preview', icon: StarsIcon, label: 'Preview' },
              { id: 'settings', icon: Settings, label: 'Config' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2 rounded text-[11px] uppercase tracking-widest font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-[#d4af37] text-[#141211]' 
                    : 'text-[#8c827c] hover:text-[#d4af37]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setActiveTab('settings')}
            className="md:hidden p-2 text-[#d4af37]"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-12"
            >
              <div className="max-w-3xl mx-auto text-center space-y-6">
                <div className="inline-block px-4 py-1.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] text-[10px] font-bold uppercase tracking-widest mb-4">
                  Google Maps Scraper Engine
                </div>
                <h1 className="text-4xl md:text-6xl font-serif tracking-tight leading-tight">
                  Prospecção <span className="text-[#d4af37] italic">Inteligente</span> de Negócios.
                </h1>
                <p className="text-[#8c827c] text-lg max-w-xl mx-auto font-light leading-relaxed">
                  Extraia informações valiosas do Google Maps e transforme em landing pages premium em segundos.
                </p>
                
                <div className="relative mt-12 group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#d4af37] to-[#8c827c] rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Ex: Clínicas de Estética em São Paulo"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full pl-14 pr-40 py-6 rounded-xl border border-[#3d3632] bg-[#141211] focus:border-[#d4af37] focus:outline-none transition-all text-white placeholder-[#3d3632]"
                    />
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#d4af37] w-6 h-6" />
                    <button 
                      onClick={handleSearch}
                      disabled={loading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#d4af37] text-[#141211] px-10 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#c4a133] transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Search Engine'}
                    </button>
                  </div>
                </div>
              </div>

              {results.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
                  {results.map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-[#141211] p-8 rounded-2xl border border-[#3d3632] hover:border-[#d4af37]/40 transition-all group shadow-2xl"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-[#1a1817] rounded-lg border border-[#3d3632] flex items-center justify-center text-[#d4af37] group-hover:bg-[#d4af37] group-hover:text-[#141211] transition-all">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="bg-[#1a1817] px-3 py-1 rounded-full border border-[#3d3632] flex items-center gap-1.5 text-xs text-amber-500 font-bold">
                          <Star className="w-3 h-3 fill-amber-500" />
                          {item.rating || 'N/A'}
                        </div>
                      </div>
                      <h3 className="text-white text-lg font-bold mb-3 line-clamp-1 italic tracking-tight">{item.title}</h3>
                      <p className="text-[#8c827c] text-xs mb-8 flex items-start gap-2 leading-relaxed">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#d4af37]" />
                        {item.address}
                      </p>
                      
                      <button 
                        onClick={() => selectBusiness(item)}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-transparent border border-[#3d3632] text-[#d4af37] text-[10px] uppercase tracking-[0.2em] font-bold rounded hover:bg-[#d4af37] hover:border-[#d4af37] hover:text-[#141211] transition-all"
                      >
                        Extract Data <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'editor' && selectedBusiness && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid lg:grid-cols-2 gap-12"
            >
              <div className="space-y-8">
                <div className="bg-[#141211] p-10 rounded-2xl border border-[#3d3632] shadow-2xl space-y-10">
                  <header className="border-b border-[#3d3632] pb-6">
                    <h2 className="text-2xl font-serif text-white uppercase tracking-widest leading-none">System <span className="text-[#d4af37]">Analysis</span></h2>
                    <p className="text-[10px] text-[#8c827c] uppercase tracking-[0.3em] mt-2">Manual configuration and parameters</p>
                  </header>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Niche Perspective</label>
                    <select 
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="w-full p-4 rounded-lg bg-[#1a1817] border border-[#3d3632] text-white focus:border-[#d4af37] outline-none appearance-none cursor-pointer"
                    >
                      {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Client Identity</label>
                      <input 
                        value={selectedBusiness.name}
                        onChange={(e) => setSelectedBusiness({...selectedBusiness, name: e.target.value})}
                        className="w-full p-4 rounded-lg bg-[#1a1817] border border-[#3d3632] text-white outline-none focus:border-[#d4af37]" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Contact Channel</label>
                      <input 
                        value={selectedBusiness.whatsapp}
                        onChange={(e) => setSelectedBusiness({...selectedBusiness, whatsapp: e.target.value})}
                        className="w-full p-4 rounded-lg bg-[#1a1817] border border-[#3d3632] text-white outline-none focus:border-[#d4af37]" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Scraped Payload</label>
                    <div className="relative">
                      <div className="p-6 bg-[#0c0b0a] rounded-xl text-[#8c827c] font-mono text-[11px] whitespace-pre-wrap leading-relaxed border-l-2 border-[#d4af37] max-h-60 overflow-y-auto">
                        {formatPrompt(selectedBusiness)}
                      </div>
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button onClick={() => {
                          const text = formatPrompt(selectedBusiness);
                          navigator.clipboard.writeText(text);
                          alert('Copied to clipboard');
                        }} className="p-2 hover:text-[#d4af37] transition-colors">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">AI Prompt Template</label>
                    <textarea 
                      value={settings.promptTemplate}
                      onChange={(e) => setSettings({...settings, promptTemplate: e.target.value})}
                      rows={6}
                      className="w-full p-4 rounded-lg bg-[#1a1817] border border-[#3d3632] text-white focus:border-[#d4af37] outline-none text-xs font-mono leading-relaxed"
                      placeholder="Use {{BUSINESS_INFO}} e {{NICHE}} como placeholders"
                    />
                  </div>

                  <button 
                    onClick={sendToAI}
                    disabled={isGenerating}
                    className="w-full py-5 bg-[#d4af37] text-[#141211] rounded font-bold uppercase tracking-[0.3em] text-[11px] shadow-lg hover:bg-white transition-all disabled:opacity-50"
                  >
                    {isGenerating ? <Clock className="animate-spin w-4 h-4 mx-auto" /> : 'Execute AI Refinement'}
                  </button>
                </div>
              </div>

              <div className="bg-[#141211] border border-[#3d3632] p-16 rounded-3xl flex items-center justify-center text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#d4af37]/5 to-transparent"></div>
                <div className="max-w-xs space-y-8 relative z-10">
                  <div className="w-24 h-24 bg-[#1a1817] rounded-2xl border border-[#3d3632] flex items-center justify-center mx-auto shadow-2xl transform transition-transform group-hover:rotate-12 duration-500">
                    <StarsIcon className="w-12 h-12 text-[#d4af37]" />
                  </div>
                  <h3 className="text-3xl font-serif text-white">Content <span className="text-[#d4af37] italic">Refinery</span></h3>
                  <p className="text-[#8c827c] text-sm leading-relaxed font-light">
                    Nossa IA especializada irá injetar gatilhos mentais sofisticados e polir os dados extraídos para criar uma experiência Rose Gold inesquecível.
                  </p>
                  <div className="pt-4 flex justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#d4af37]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#3d3632]"></span>
                    <span className="w-2 h-2 rounded-full bg-[#3d3632]"></span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'preview' && selectedBusiness && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-[#141211] p-8 rounded-2xl border border-[#3d3632] shadow-2xl">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-green-500/10 text-green-500 rounded-lg border border-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Deployment Ready</h3>
                    <p className="text-[#8c827c] text-[11px] uppercase tracking-widest mt-1">Aesthetic theme: <span className="text-[#d4af37]">Rose Gold Sophistication</span></p>
                  </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  <button 
                    onClick={generateSingleHTML}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-[#d4af37] text-[#141211] rounded text-[11px] uppercase tracking-[0.2em] font-bold hover:bg-white transition-all shadow-xl"
                  >
                    <Download className="w-4 h-4" /> Download HTML
                  </button>
                  <button 
                    onClick={() => setActiveTab('editor')}
                    className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-transparent border border-[#3d3632] text-white rounded text-[11px] uppercase tracking-[0.2em] font-bold hover:border-[#d4af37] transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Reset Shell
                  </button>
                </div>
              </div>

              <div className="rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.1)] border border-[#3d3632] bg-[#141211]">
                <div className="h-14 bg-[#1a1817] flex items-center justify-between px-8 border-b border-[#3d3632]">
                   <div className="flex gap-2">
                     <div className="w-3.5 h-3.5 rounded-full bg-[#3d3632]"></div>
                     <div className="w-3.5 h-3.5 rounded-full bg-[#3d3632]"></div>
                     <div className="w-3.5 h-3.5 rounded-full bg-[#3d3632]"></div>
                   </div>
                   <div className="flex-1 max-w-lg text-center mx-4">
                     <div className="bg-[#141211] text-[#8c827c] text-[10px] font-mono px-4 py-1.5 rounded-full border border-[#3d3632] truncate uppercase tracking-widest">
                       https://{(selectedBusiness.name || 'business').toLowerCase().replace(/\s/g, '-')}.business.ai
                     </div>
                   </div>
                   <div className="w-12"></div>
                </div>
                <div className="relative">
                  <iframe 
                    srcDoc={generateHTMLInternal(selectedBusiness, niche)}
                    className="w-full h-[900px] border-none"
                    title="MetaBusiness Landing Preview"
                  />
                  <div className="absolute top-0 right-0 p-4">
                    <div className="bg-[#141211]/80 backdrop-blur px-4 py-2 rounded-full border border-[#d4af37]/20 text-[10px] text-[#d4af37] font-bold uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" /> Live Perspective
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto bg-[#141211] p-16 rounded-3xl border border-[#3d3632] shadow-2xl space-y-12 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37] opacity-[0.03] rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
              
              <div className="text-center space-y-4 relative z-10">
                <h2 className="text-4xl font-serif text-white uppercase tracking-widest">System <span className="text-[#d4af37]">Core</span></h2>
                <p className="text-[#8c827c] text-xs uppercase tracking-[0.4em] font-bold">API Connectivity Linkage</p>
              </div>

              <div className="space-y-8 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Search Engine Interface (SerpApi)</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={settings.serpApiKey}
                      onChange={(e) => setSettings({...settings, serpApiKey: e.target.value})}
                      className="w-full p-5 pl-12 rounded-xl bg-[#1a1817] border border-[#3d3632] text-white focus:border-[#d4af37] outline-none"
                      placeholder="••••••••••••••••"
                    />
                    <Settings className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3d3632]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4af37]">Global AI Prompt Template</label>
                  <textarea 
                    value={settings.promptTemplate}
                    onChange={(e) => setSettings({...settings, promptTemplate: e.target.value})}
                    rows={4}
                    className="w-full p-5 rounded-xl bg-[#1a1817] border border-[#3d3632] text-white focus:border-[#d4af37] outline-none text-xs font-mono"
                    placeholder="Customize how AI generates content..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4">
                    {['picsum', 'unsplash', 'gemini'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setSettings({...settings, imageApi: type as any})}
                        className={`py-4 rounded-lg border text-[10px] uppercase tracking-widest font-bold transition-all ${
                          settings.imageApi === type 
                            ? 'bg-[#d4af37] text-[#141211] border-[#d4af37]' 
                            : 'bg-[#1a1817] border-[#3d3632] text-[#8c827c] hover:border-[#d4af37]/40'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => saveSettings(settings)}
                  className="w-full py-6 bg-white text-[#141211] rounded font-bold uppercase tracking-[0.3em] text-[11px] shadow-2xl hover:bg-[#d4af37] transition-all"
                >
                  Commit Modifications
                </button>

                <p className="text-[9px] text-center text-[#3d3632] uppercase tracking-[0.5em]">Auth keys persist in local sandbox environment only.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Status Bar */}
      {selectedBusiness && activeTab !== 'preview' && (
        <div className="fixed bottom-8 left-8 bg-[#141211] px-8 py-4 rounded-full shadow-2xl border border-[#3d3632] flex items-center gap-4 z-50">
          <div className="w-2 h-2 bg-[#d4af37] rounded-full animate-pulse shadow-[0_0_10px_#d4af37]"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#8c827c]">
            Active Buffer: <span className="text-white italic">{selectedBusiness.name}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// Separate Icon fix for TS
function StarsIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}

function generateHTMLInternal(selectedBusiness: BusinessData, niche: string) {
  const keywords = NICHE_IMAGE_KEYWORDS[niche] || "luxury,clinic,spa";
  const heroImage = `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=800&q= keywords=${keywords}`; 
  // Fallback if Unsplash URL pattern is tricky, using a themed placeholder for now
  const themedHero = `https://source.unsplash.com/featured/800x1000?${keywords},luxury`;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${selectedBusiness.name} | ${niche}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --nude: #Fdf6f2;
            --rose: #E5b2a0;
            --gold: #C5a059;
            --dark: #2D2424;
        }
        body { font-family: 'Inter', sans-serif; background-color: var(--nude); color: var(--dark); }
        .font-serif { font-family: 'Playfair Display', serif; }
        .bg-rose-gold { background: linear-gradient(135deg, var(--rose) 0%, var(--gold) 100%); }
        .text-gold { color: var(--gold); }
        .border-gold { border-color: var(--gold); }
    </style>
</head>
<body class="overflow-x-hidden">
    <!-- Header -->
    <header class="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-stone-100">
        <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 class="font-serif text-2xl font-bold tracking-tight text-gold">${selectedBusiness.name}</h1>
            <a href="https://wa.me/${(selectedBusiness.whatsapp || '').replace(/\D/g, '')}" class="hidden md:block bg-rose-gold text-white px-6 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition">Agendar Agora</a>
        </div>
    </header>

    <!-- Hero -->
    <section class="pt-40 pb-20 px-6 overflow-hidden">
        <div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div class="space-y-10 relative z-10 transition-all duration-1000">
                <span class="inline-block px-4 py-1.5 rounded-full bg-rose-100 text-rose-500 text-[10px] font-bold uppercase tracking-[0.2em]">${niche}</span>
                <h2 class="font-serif text-5xl md:text-8xl leading-[1.1] tracking-tight">Experiência <span class="text-gold italic block">Premium</span></h2>
                <p class="text-stone-500 text-lg max-w-md leading-relaxed font-light">${selectedBusiness.differential}</p>
                <div class="flex flex-col sm:flex-row gap-6">
                    <a href="https://wa.me/${(selectedBusiness.whatsapp || '').replace(/\D/g, '')}" class="bg-rose-gold text-white px-12 py-5 rounded-full text-sm font-bold uppercase tracking-widest text-center shadow-[0_20px_50px_rgba(229,178,160,0.3)] hover:scale-105 transition-all">Agendar Avaliação</a>
                </div>
            </div>
            <div class="relative">
                <div class="absolute -inset-10 bg-gold/5 rounded-full blur-3xl"></div>
                <div class="relative group">
                    <div class="absolute inset-0 bg-rose/20 rounded-[4rem] rotate-3 group-hover:rotate-0 transition-transform duration-700"></div>
                    <img src="${themedHero}" alt="Experience" class="relative rounded-[4rem] shadow-2xl z-10 w-full aspect-[4/5] object-cover border-8 border-white">
                </div>
            </div>
        </div>
    </section>

    <!-- Tratamentos -->
    <section class="py-32 bg-white relative">
        <div class="max-w-7xl mx-auto px-6 text-center space-y-6 mb-24">
            <h3 class="font-serif text-5xl">Nossa Especialidade</h3>
            <div class="w-20 h-1 bg-gold mx-auto"></div>
            <p class="text-stone-400 uppercase tracking-[0.3em] text-[10px] font-bold">Protocolos Exclusivos</p>
        </div>
        <div class="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
            ${selectedBusiness.services.map((s, i) => `
            <div class="group p-10 border border-stone-100 rounded-[3rem] hover:border-gold/30 hover:shadow-[0_30px_60px_-15px_rgba(197,160,89,0.1)] transition-all space-y-6 bg-stone-50/30">
                <div class="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gold font-bold text-xl group-hover:bg-rose-gold group-hover:text-white transition-all transform group-hover:rotate-12">${i + 1}</div>
                <h4 class="text-2xl font-serif font-bold group-hover:text-gold transition-colors">${s}</h4>
                <p class="text-stone-400 text-sm leading-relaxed">Desenvolvemos técnicas proprietárias para garantir o máximo de sofisticação e resultados em cada sessão.</p>
            </div>
            `).join('')}
        </div>
    </section>

    <!-- Galeria Social (Maps Photo) -->
    <section class="py-32 bg-stone-50 overflow-hidden">
        <div class="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
            <div class="order-2 md:order-1 relative">
                ${selectedBusiness.thumbnail ? `
                <div class="relative group">
                    <div class="absolute inset-0 bg-gold/10 rounded-3xl -rotate-6"></div>
                    <img src="${selectedBusiness.thumbnail}" class="relative w-full aspect-square object-cover rounded-3xl shadow-2xl z-10 border-4 border-white grayscale hover:grayscale-0 transition-all duration-700" alt="Local">
                    <div class="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl z-20">
                        <div class="flex items-center gap-2 text-gold mb-2">
                             ${'★'.repeat(Math.round(selectedBusiness.rating))}
                        </div>
                        <p class="text-[10px] uppercase font-bold tracking-widest text-stone-400">Avaliações Google</p>
                    </div>
                </div>
                ` : `
                <div class="grid grid-cols-2 gap-4">
                    <img src="https://source.unsplash.com/400x400?${keywords},interior" class="rounded-3xl shadow-lg aspect-square object-cover">
                    <img src="https://source.unsplash.com/400x400?${keywords},service" class="rounded-3xl shadow-lg aspect-square object-cover mt-8">
                </div>
                `}
            </div>
            <div class="order-1 md:order-2 space-y-8">
                 <h3 class="font-serif text-5xl">Confiança & <br><span class="italic text-gold">Credibilidade</span></h3>
                 <p class="text-stone-500 text-lg leading-relaxed">
                    Com mais de <strong>${selectedBusiness.reviews} avaliações</strong> positivas no Google Maps, somos referência absoluta em ${niche} no bairro ${selectedBusiness.city}.
                 </p>
                 <div class="flex items-center gap-6 pt-4">
                    <div class="w-12 h-px bg-gold"></div>
                    <span class="text-[10px] uppercase font-bold tracking-[0.4em] text-gold">Unidade ${selectedBusiness.city}</span>
                 </div>
            </div>
        </div>
    </section>

    <!-- Depoimento -->
    <section class="py-32 bg-white">
        <div class="max-w-4xl mx-auto px-6 text-center space-y-12">
            <div class="font-serif text-4xl text-stone-700 leading-snug">
                "O nível de detalhamento e o ambiente sofisticado fazem toda a diferença. Finalmente encontrei o lugar onde me sinto verdadeiramente cuidada."
            </div>
            <div class="flex items-center justify-center gap-6">
                <div class="w-16 h-16 rounded-full bg-gradient-to-br from-rose-100 to-gold/20 flex items-center justify-center font-bold text-gold">MS</div>
                <div class="text-left">
                    <p class="font-bold text-xl">Mariana Santos</p>
                    <p class="text-xs text-gold uppercase tracking-[0.2em] font-bold">Digital Influencer</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Promoção -->
    ${selectedBusiness.promotion ? `
    <section class="py-32 bg-[#2D2424] text-white relative overflow-hidden">
        <div class="absolute top-0 right-0 w-96 h-96 bg-gold opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div class="max-w-7xl mx-auto px-6 text-center space-y-10 relative z-10">
            <h3 class="text-rose font-bold uppercase tracking-[0.4em] text-xs">Oportunidade Exclusiva</h3>
            <p class="text-5xl md:text-7xl font-serif italic">${selectedBusiness.promotion}</p>
            <div class="pt-6">
                <a href="https://wa.me/${(selectedBusiness.whatsapp || '').replace(/\D/g, '')}" class="inline-block bg-white text-stone-900 px-16 py-6 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-gold hover:text-white transition-all shadow-2xl">Resgatar via WhatsApp</a>
            </div>
        </div>
    </section>
    ` : ''}

    <!-- Footer -->
    <footer id="contato" class="bg-stone-50 border-t border-stone-100 py-32 px-6">
        <div class="max-w-7xl mx-auto grid md:grid-cols-3 gap-20">
            <div class="space-y-8">
                <h4 class="font-serif text-4xl font-bold text-gold">${selectedBusiness.name}</h4>
                <p class="text-stone-400 text-sm leading-relaxed">${selectedBusiness.address}</p>
                <div class="flex gap-4">
                    <div class="w-10 h-10 border border-stone-200 rounded-full flex items-center justify-center text-stone-400 hover:border-gold hover:text-gold transition-colors">IG</div>
                    <div class="w-10 h-10 border border-stone-200 rounded-full flex items-center justify-center text-stone-400 hover:border-gold hover:text-gold transition-colors">FB</div>
                </div>
            </div>
            <div class="space-y-8">
                <h5 class="text-stone-900 font-bold uppercase tracking-[0.2em] text-[10px]">Horários</h5>
                <p class="text-stone-500 text-sm italic">${selectedBusiness.hours}</p>
                <h5 class="text-stone-900 font-bold uppercase tracking-[0.2em] text-[10px] pt-4">Contato</h5>
                <p class="text-2xl font-serif text-gold">${selectedBusiness.whatsapp}</p>
            </div>
            <div class="bg-white p-10 rounded-3xl shadow-sm border border-stone-100 flex flex-col justify-center items-center text-center space-y-6">
                <h5 class="font-serif text-2xl">Pronto para a transformação?</h5>
                <p class="text-stone-400 text-sm italic">Reserve sua sessão exclusiva hoje mesmo.</p>
                <a href="https://wa.me/${(selectedBusiness.whatsapp || '').replace(/\D/g, '')}" class="w-full bg-rose-gold text-white py-4 rounded-full font-bold shadow-lg">Agendar Agora</a>
            </div>
        </div>
    </footer>

    <!-- Botão WhatsApp Flutuante -->
    <a href="https://wa.me/${(selectedBusiness.whatsapp || '').replace(/\D/g, '')}" class="fixed bottom-8 right-8 w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform z-50">
        <svg fill="#fff" width="32" height="32" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>
</body>
</html>
  `;
}
