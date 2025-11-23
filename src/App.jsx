import React, { useState } from 'react';
import { 
  Search, Upload, MapPin, Calendar, Camera, 
  CheckCircle, XCircle, Shield, User, Menu, 
  BarChart3, Eye, LogOut, ArrowRight, Phone, Mail, Lock 
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATION & MOCK DATA
// ==========================================
const CONFIG = {
  appName: "LostFound.AI",
  tagline: "AI-Powered Object Recovery System",
  categories: ["Electronics", "Clothing", "ID/Docs", "Accessories", "Books", "Keys"],
  locations: ["Canteen", "Library", "Main Lab", "Parking Lot", "Auditorium", "Sports Complex"],
  
  // Mock Data for Matches
  mockMatches: [
    { 
      id: 1, 
      name: "Blue Fossil Watch", 
      score: 94, 
      location: "Library Table 4", 
      time: "2 hours ago", 
      img: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&q=80&w=300",
      finderPhone: "+91 98765 43210" 
    },
    { 
      id: 2, 
      name: "Black Sony Headphones", 
      score: 82, 
      location: "Canteen", 
      time: "Yesterday", 
      img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=300",
      finderPhone: "+91 99887 76655" 
    },
  ],

  adminStats: {
    totalLost: 142,
    totalFound: 110,
    resolved: 89,
  }
};

// ==========================================
// 2. REUSABLE UI COMPONENTS
// ==========================================

const Button = ({ children, onClick, variant = 'primary', className = '', type="button" }) => {
  const baseStyle = "px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 cursor-pointer";
  const variants = {
    primary: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50",
    secondary: "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20",
    outline: "border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10",
    danger: "bg-red-500/80 text-white hover:bg-red-600"
  };

  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", placeholder, icon: Icon, value, onChange }) => (
  <div className="mb-4">
    <label className="block text-gray-300 text-sm font-medium mb-2">{label}</label>
    <div className="relative">
      {Icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
          <Icon size={18} />
        </div>
      )}
      <input 
        type={type} 
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${Icon ? 'pl-10' : ''}`}
      />
    </div>
  </div>
);

const Select = ({ label, options }) => (
  <div className="mb-4">
    <label className="block text-gray-300 text-sm font-medium mb-2">{label}</label>
    <select className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none">
      {options.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
    </select>
  </div>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl ${className}`}>
    {children}
  </div>
);

// ==========================================
// 3. MAIN APP COMPONENT
// ==========================================

export default function App() {
  // --- STATE MANAGEMENT ---
  const [activeView, setActiveView] = useState('login'); // Start at login
  const [currentUser, setCurrentUser] = useState(null); // Stores logged-in user info
  
  // Mock Login/Signup Logic
  const handleLogin = (e) => {
    e.preventDefault();
    // Simulating a successful login
    setCurrentUser({ name: "Student User", phone: "9876543210", email: "student@college.edu" });
    setActiveView('home');
  };

  const handleSignup = (e) => {
    e.preventDefault();
    // Simulating a successful signup
    setCurrentUser({ name: "New Student", phone: "9123456789", email: "new@college.edu" });
    setActiveView('home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveView('login');
  };

  // --- VIEWS ---

  // 1. LOGIN SCREEN
  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/30 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px]"></div>

      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
            <Search className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white">{CONFIG.appName}</h1>
          <p className="text-gray-400 mt-2">Login to report or claim items</p>
        </div>

        <form onSubmit={handleLogin}>
          <Input label="Email Address" type="email" placeholder="student@college.edu" icon={Mail} />
          <Input label="Password" type="password" placeholder="••••••••" icon={Lock} />
          
          <div className="flex justify-between items-center mb-6 text-sm">
            <label className="flex items-center text-gray-400 cursor-pointer">
              <input type="checkbox" className="mr-2 rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500" />
              Remember me
            </label>
            <a href="#" className="text-purple-400 hover:text-purple-300">Forgot Password?</a>
          </div>

          <Button type="submit" className="w-full">Login</Button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          Don't have an account?{' '}
          <button onClick={() => setActiveView('signup')} className="text-purple-400 font-bold hover:text-purple-300 hover:underline">
            Sign Up
          </button>
        </p>
      </Card>
    </div>
  );

  // 2. SIGNUP SCREEN
  const renderSignup = () => (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 -z-20"></div>
      
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-gray-400 mt-2">Join the community to help find items</p>
        </div>

        <form onSubmit={handleSignup}>
          <Input label="Full Name" placeholder="John Doe" icon={User} />
          <Input label="Email Address" type="email" placeholder="student@college.edu" icon={Mail} />
          
          {/* PHONE NUMBER FIELD - CRITICAL */}
          <Input label="Phone Number" type="tel" placeholder="+91 98765 43210" icon={Phone} />
          
          <Input label="Password" type="password" placeholder="Create a password" icon={Lock} />

          <Button type="submit" className="w-full">Create Account</Button>
        </form>

        <p className="mt-6 text-center text-gray-400 text-sm">
          Already have an account?{' '}
          <button onClick={() => setActiveView('login')} className="text-purple-400 font-bold hover:text-purple-300 hover:underline">
            Login
          </button>
        </p>
      </Card>
    </div>
  );

  // 3. HOME SCREEN
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/30 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-600/30 rounded-full blur-[100px]"></div>
      </div>

      <span className="bg-white/10 text-purple-200 text-sm font-medium px-4 py-1.5 rounded-full mb-6 border border-white/10 animate-pulse">
        👋 Welcome back, {currentUser?.name || 'Student'}
      </span>

      <h1 className="text-6xl md:text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-indigo-200 mb-6 drop-shadow-lg">
        {CONFIG.appName}
      </h1>
      <p className="text-xl text-gray-300 max-w-2xl mb-10 leading-relaxed">
        {CONFIG.tagline}. Upload an image, and our AI will find matches instantly using advanced embedding features.
      </p>
      
      <div className="flex flex-col md:flex-row gap-6">
        <Button onClick={() => setActiveView('reportLost')}>
          <Search size={20} /> I Lost Something
        </Button>
        <Button variant="secondary" onClick={() => setActiveView('reportFound')}>
          <Camera size={20} /> I Found Something
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 w-full max-w-4xl">
        {[
          { icon: <Eye className="text-purple-400" />, title: "AI Vision", desc: "Automatic image recognition" },
          { icon: <MapPin className="text-blue-400" />, title: "Smart Location", desc: "Heatmap based tracking" },
          { icon: <Shield className="text-green-400" />, title: "Secure Claims", desc: "Verified return process" }
        ].map((f, i) => (
          <Card key={i} className="hover:bg-white/5 transition-colors">
            <div className="flex flex-col items-center">
              <div className="p-3 bg-white/10 rounded-full mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold text-white">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  // 4. FORM SCREEN (Lost or Found)
  const renderForm = (type) => (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setActiveView('home')} className="text-gray-400 hover:text-white">
          <ArrowRight className="rotate-180" />
        </button>
        <h2 className="text-3xl font-bold text-white">
          {type === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
        </h2>
      </div>

      <Card>
        {/* Alert Badge for Contact Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Phone className="text-blue-400 mt-1 flex-shrink-0" size={18} />
          <div>
            <p className="text-blue-200 text-sm font-semibold">Contact Information</p>
            <p className="text-blue-300/70 text-xs">
              Your phone number <span className="text-white font-mono">{currentUser?.phone}</span> will be securely shared if a match is found so the finder can contact you.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2 border-2 border-dashed border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-purple-500 hover:bg-slate-800/50 transition-all cursor-pointer group">
            <Upload size={40} className="mb-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
            <p className="font-medium">Click to upload image</p>
            <p className="text-xs mt-2 text-gray-500">AI will auto-detect category & color</p>
          </div>

          <Input label="Item Name" placeholder="e.g., Blue iPhone 13" />
          <Select label="Category" options={CONFIG.categories} />
          <Select label="Location" options={CONFIG.locations} />
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">Date & Time</label>
            <input type="datetime-local" className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white" />
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <Input label="Detailed Description" placeholder="Any scratches, stickers, or unique marks?" />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <Button variant="secondary" onClick={() => setActiveView('home')}>Cancel</Button>
          <Button onClick={() => setActiveView('matches')}>
             {type === 'lost' ? 'Find Matches' : 'Submit Report'}
          </Button>
        </div>
      </Card>
    </div>
  );

  // 5. MATCHES SCREEN
  const renderMatches = () => (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveView('reportLost')} className="text-gray-400 hover:text-white">
            <ArrowRight className="rotate-180" />
          </button>
          <h2 className="text-3xl font-bold text-white">AI Matches Found</h2>
        </div>
        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium border border-green-500/30">
          Processing Complete
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Best Match Highlight */}
        <div className="bg-gradient-to-r from-indigo-900/80 to-purple-900/80 border border-purple-500/50 rounded-2xl p-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
             TOP MATCH
           </div>
           <div className="flex flex-col md:flex-row gap-6 items-center">
             <img src={CONFIG.mockMatches[0].img} alt="Match" className="w-32 h-32 object-cover rounded-xl border-2 border-purple-400/30" />
             <div className="flex-1">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-2xl font-bold text-white">{CONFIG.mockMatches[0].name}</h3>
                 <span className="text-2xl font-bold text-green-400">{CONFIG.mockMatches[0].score}%</span>
               </div>
               <div className="flex gap-4 text-gray-300 text-sm mb-4">
                 <span className="flex items-center gap-1"><MapPin size={14} /> {CONFIG.mockMatches[0].location}</span>
                 <span className="flex items-center gap-1"><Calendar size={14} /> {CONFIG.mockMatches[0].time}</span>
               </div>
               <p className="text-gray-400 text-sm mb-6">AI analysis detected high similarity in color histogram and object geometry.</p>
               
               {/* ACTION BUTTONS */}
               <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="py-2 text-sm flex-1">Request Claim</Button>
                  {/* CONTACT FINDER BUTTON */}
                  <Button variant="secondary" className="py-2 text-sm flex-1 bg-white/10 hover:bg-green-500/20 hover:text-green-300 border-transparent">
                    <Phone size={16} /> Call Finder: {CONFIG.mockMatches[0].finderPhone}
                  </Button>
               </div>

             </div>
           </div>
        </div>

        {/* Other Matches */}
        <h3 className="text-xl font-semibold text-white mt-4">Other Potential Matches</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONFIG.mockMatches.slice(1).map((item) => (
            <Card key={item.id} className="hover:bg-slate-800/80 transition-colors">
              <div className="flex gap-4">
                <img src={item.img} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
                <div>
                  <h4 className="font-bold text-white">{item.name}</h4>
                  <p className="text-purple-400 font-bold text-sm mb-1">{item.score}% Match</p>
                  <button className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-md transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  // 6. DASHBOARD
  const renderDashboard = () => (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold text-white mb-8">My Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/30">
          <h3 className="text-gray-400 text-sm font-bold uppercase">Items Lost</h3>
          <p className="text-4xl font-bold text-white mt-2">2</p>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/30">
          <h3 className="text-gray-400 text-sm font-bold uppercase">Items Found</h3>
          <p className="text-4xl font-bold text-white mt-2">5</p>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border-blue-500/30">
          <h3 className="text-gray-400 text-sm font-bold uppercase">Pending Claims</h3>
          <p className="text-4xl font-bold text-white mt-2">1</p>
        </Card>
      </div>

      <Card>
        <h3 className="text-xl font-semibold text-white mb-6">Recent Activity</h3>
        <div className="space-y-4">
           <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                 <Search size={20} />
               </div>
               <div>
                 <p className="text-white font-medium">Reported Lost Item: Calculator</p>
                 <p className="text-gray-500 text-sm">2 days ago • Processing</p>
               </div>
             </div>
             <span className="px-3 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
               Searching
             </span>
           </div>
        </div>
      </Card>
    </div>
  );

  // 7. ADMIN
  const renderAdmin = () => (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
         <h2 className="text-3xl font-bold text-white">Admin Console</h2>
         <div className="flex gap-2">
            <Button variant="secondary" className="py-2 text-sm">Download Report</Button>
            <Button className="py-2 text-sm bg-red-600 hover:bg-red-700">Purge Spam</Button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
         {Object.entries(CONFIG.adminStats).map(([key, val]) => (
           <Card key={key} className="text-center py-8">
              <p className="text-3xl font-bold text-white">{val}</p>
              <p className="text-gray-400 text-sm uppercase mt-2">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
           </Card>
         ))}
         <Card className="text-center py-8 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition">
            <BarChart3 className="text-purple-400 mb-2" />
            <p className="text-white font-medium">View Analytics</p>
         </Card>
      </div>
    </div>
  );

  // --- RENDER CONTROL ---

  // If not logged in, show Login or Signup only
  if (activeView === 'login') return renderLogin();
  if (activeView === 'signup') return renderSignup();

  // If logged in, show the main app structure
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-purple-500 selection:text-white pb-20">
      
      {/* Header / Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveView('home')}>
              <div className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <Search className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight">{CONFIG.appName}</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              {['Home', 'Dashboard', 'Admin'].map((item) => (
                <button 
                  key={item}
                  onClick={() => setActiveView(item.toLowerCase())}
                  className={`text-sm font-medium transition-colors ${activeView === item.toLowerCase() ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
                >
                  {item}
                </button>
              ))}
              <Button variant="primary" className="py-2 px-4 text-sm" onClick={() => setActiveView('reportLost')}>
                Report Lost
              </Button>
              
              {/* User Profile Dropdown (Mock) */}
              <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold cursor-pointer hover:ring-2 ring-purple-500" title="Logout" onClick={handleLogout}>
                {currentUser?.name.charAt(0)}
              </div>
            </div>
            <div className="md:hidden text-gray-300">
              <Menu />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {activeView === 'home' && renderHome()}
        {activeView === 'reportLost' && renderForm('lost')}
        {activeView === 'reportFound' && renderForm('found')}
        {activeView === 'matches' && renderMatches()}
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'admin' && renderAdmin()}
      </main>
    </div>
  );
}