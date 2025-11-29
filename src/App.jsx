import React, { useState, useEffect } from 'react';
import {
  Search, Upload, MapPin, Calendar, Camera,
  CheckCircle, XCircle, Shield, User, Menu,
  BarChart3, Eye, LogOut, ArrowRight, Phone, Mail, Lock, Loader2, Trash2
} from 'lucide-react';

// FIREBASE IMPORTS
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';


// ==========================================
// 1. CONFIGURATION
// ==========================================
const CONFIG = {
  appName: "LostFound.AI",
  tagline: "AI-Powered Object Recovery System",
  categories: ["Electronics", "Clothing", "ID/Docs", "Accessories", "Books", "Keys", "Other"],
  locations: ["Canteen", "Library", "Parking Lot", "Seminar Hall", "Sports Complex", "Classroom", "Others", "Not Sure"

  ]
};

// ==========================================
// 2. HELPER: CONVERT & COMPRESS IMAGE
// ==========================================
const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        // Create a canvas to resize the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set max width to 600px (Perfect for web viewing, small file size)
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;

        // If image is smaller than 600px, keep original size
        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to JPEG with 0.7 quality (Good balance)
        // This makes the string much shorter!
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

// ==========================================
// 3. REUSABLE UI COMPONENTS
// ==========================================
const Button = ({ children, onClick, variant = 'primary', className = '', type = "button", disabled }) => {
  const baseStyle = "px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50",
    secondary: "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20",
    outline: "border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10",
    danger: "bg-red-500/80 text-white hover:bg-red-600"
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, type = "text", placeholder, icon: Icon, value, onChange, required }) => (
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
        required={required}
        className={`w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${Icon ? 'pl-10' : ''}`}
      />
    </div>
  </div>
);

const Select = ({ label, options, value, onChange }) => (
  <div className="mb-4">
    <label className="block text-gray-300 text-sm font-medium mb-2">{label}</label>
    <select
      value={value}
      onChange={onChange}
      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
    >
      <option value="" disabled>Select an option</option>
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
// 4. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [activeView, setActiveView] = useState('login');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  // Item Form State
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // Stores Base64 string
  const [matches, setMatches] = useState([]);
  // Track if user has checked their notifications
  const [notificationsRead, setNotificationsRead] = useState(false);
  // State for the "View Details" Modal
  const [selectedItem, setSelectedItem] = useState(null);

  // New State for "Custody" logic
  const [custody, setCustody] = useState('me'); // Options: 'me' or 'authority'
  const [authorityDetails, setAuthorityDetails] = useState(''); // e.g., "Library Staff"

  // Date & Time State
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Dashboard Data
  const [myItems, setMyItems] = useState([]);

  // CALCULATION: How many people are waiting for ME?
  // Logic: Items I Found (i.uid === user.uid) AND Status is 'claimed_pending'
  const pendingClaimsCount = myItems.filter(i =>
    i.type === 'found' &&
    i.uid === user.uid &&
    i.status === 'claimed_pending'
  ).length;

  // EFFECT: If the number of claims changes (new claim arrives), show badge again
  useEffect(() => {
    if (pendingClaimsCount > 0) {
      setNotificationsRead(false);
    }
  }, [pendingClaimsCount]);

  // AUTH LISTENER
  // AUTH LISTENER (Updated to fetch User Profile)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setActiveView('home');
        
        // 1. Fetch User's Items
        fetchMyItems(currentUser.uid);

        // ✅ 2. FETCH USER PROFILE (Name & Phone)
        // This ensures that when you claim something, we know who you are!
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setName(userData.name || "");
            setPhone(userData.phone || "");
            // Note: We are updating the 'name' and 'phone' state variables
            // so they are ready to be used if you claim an item.
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }

      } else {
        setUser(null);
        setActiveView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  // --- ACTIONS ---

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // 2. Save extra details (Phone, Name) to Firestore 'users' collection
      await addDoc(collection(db, "users"), {
        uid: userCredential.user.uid,
        name: name,
        phone: phone,
        email: email
      });
      alert("Account Created Successfully!");
    } catch (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleLogout = () => signOut(auth);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await convertToBase64(file);
      setSelectedImage(base64);
    }
  };

  // ACTION: User claims an item they see in matches
  const handleClaimItem = async (itemId) => {
    if (confirm("Send a claim request to the finder? They will see your phone number.")) {
      try {
        const itemRef = doc(db, "items", itemId);
        await updateDoc(itemRef, {
          status: 'claimed_pending',
          claimedBy: user.uid,
          claimantName: user.displayName || name, // Fallback to local state name
          claimantPhone: user.phoneNumber || phone
        });

        // ✅ NEW LINE: Force re-fetch so the item appears in Dashboard immediately
        await fetchMyItems(user.uid);

        alert("Claim request sent! Check your dashboard.");
        setActiveView('dashboard');
      } catch (error) {
        console.error("Error claiming:", error);
        alert("Could not send claim.");
      }
    }
  };

  // ACTION: Finder marks item as returned
  // ACTION: Close the case (Either returned to owner OR submitted to staff)
  const handleMarkReturned = async (item) => {
    let details = "";

    // CASE 1: You said earlier that you gave it to Authority (Library/Guard)
    if (item.custody === 'authority') {
      if (!confirm(`Confirm that you have successfully submitted this item to: ${item.authorityDetails}?`)) {
        return;
      }
      details = `Submitted to: ${item.authorityDetails}`;
    }
    // CASE 2: You had it with you, now you are returning it
    else {
      const input = prompt("To whom did you return this item? (e.g., 'Owner', 'Security Guard')");
      if (!input) return;
      details = input;
    }

    try {
      const itemRef = doc(db, "items", item.id);
      await updateDoc(itemRef, {
        status: 'returned', // We still call it 'returned' to move it to History
        returnedAt: serverTimestamp(),
        handoverDetails: details
      });

      await fetchMyItems(user.uid);
      alert("Report closed successfully!");

    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error closing report");
    }
  };

  // ACTION: Loser confirms they got their item back (from Finder, Guard, or found it themselves)
  const handleOwnerReceived = async (itemId) => {
    if (confirm("Have you successfully received this item back?")) {
      try {
        const itemRef = doc(db, "items", itemId);
        await updateDoc(itemRef, {
          status: 'returned', // Move to History
          returnedAt: serverTimestamp(),
          handoverDetails: 'Recovered by Owner' // Audit log
        });

        await fetchMyItems(user.uid);
        alert("Great news! Case closed.");

      } catch (error) {
        console.error("Error:", error);
        alert("Error updating status");
      }
    }
  };

  // ACTION: Delete an item
  const handleDelete = async (id) => {
    if (confirm("Delete this report permanently?")) {
      try {
        await deleteDoc(doc(db, "items", id));
        setMyItems(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        alert("Error deleting: " + error.message);
      }
    }
  };

  const handleSubmitItem = async (type) => {
    // 1. VALIDATION: Date is required, but Time is NOT required.
    if (!itemName || !category || !location || !date) {
      alert("Please fill in the required fields (Name, Category, Location, and Date).");
      return;
    }
    setLoading(true);

    try {
      const itemData = {
        name: itemName,
        category,
        location,
        description,
        image: selectedImage,
        type: type,
        uid: user.uid,
        userEmail: user.email,
        status: 'open',
        createdAt: serverTimestamp(),

        // ✅ SAVING THE DATA (Even if time is empty, it saves as "")
        dateLostFound: date,
        timeLostFound: time,

        custody: type === 'found' ? custody : 'me',
        authorityDetails: type === 'found' ? authorityDetails : ''
      };

      // Save to Firebase
      await addDoc(collection(db, "items"), itemData);

      // Refresh Dashboard
      await fetchMyItems(user.uid);

      if (type === 'lost') {
        findMatches(itemName, category, location);
        setActiveView('matches');
      } else {
        alert("Report Submitted Successfully!");
        setActiveView('home');
      }

      // Reset Form
      setItemName(''); setCategory(''); setLocation(''); setDescription(''); setSelectedImage(null);
      setDate(''); setTime(''); // Reset new fields
    } catch (error) {
      console.error(error);
      alert("Error saving item");
    }
    setLoading(false);
  };

  // THE "FAKE AI" LOGIC
  // THE ROBUST MATCHING LOGIC (With Debugging)
  const findMatches = async (searchName, searchCategory, searchLocation) => {
    setLoading(true);
    console.log(`🔎 Searching for: ${searchName} | ${searchCategory} | ${searchLocation}`);

    try {
      // 1. Fetch ALL found items
      const q = query(
        collection(db, "items"),
        where("type", "==", "found")
      );

      const querySnapshot = await getDocs(q);
      const results = [];

      // Prepare search name (Handle empty case safely)
      const searchNameLower = searchName ? searchName.toLowerCase() : "";

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        let score = 0;

        // DEBUG: Print what we are comparing
        // console.log(`Checking item: ${data.name} (${data.category})`);

        // 1. NAME MATCH (50 Points)
        if (data.name && searchNameLower) {
          const foundNameLower = data.name.toLowerCase();

          // Simple Check: Does one name contain the other?
          // e.g. "Black Watch" contains "Watch"
          if (foundNameLower.includes(searchNameLower) || searchNameLower.includes(foundNameLower)) {
            score += 50;
          }
        }

        // 2. CATEGORY MATCH (30 Points)
        if (data.category === searchCategory) {
          score += 30;
        }

        // 3. LOCATION MATCH (20 Points)
        if (data.location === searchLocation) {
          score += 20;
        }

        // Add to results if there is ANY similarity
        if (score > 0) {
          results.push({ id: doc.id, ...data, score });
        }
      });

      console.log(`✅ Found ${results.length} matches.`);

      // Sort: Best matches top
      results.sort((a, b) => b.score - a.score);
      setMatches(results);

    } catch (error) {
      console.error("Error finding matches:", error);
      alert("Error searching for matches");
    }
    setLoading(false);
  };

  const fetchMyItems = async (currentUid) => {
    try {
      // 1. Get items I CREATED
      const q1 = query(collection(db, "items"), where("uid", "==", currentUid));
      const snap1 = await getDocs(q1);

      // 2. Get items I CLAIMED
      const q2 = query(collection(db, "items"), where("claimedBy", "==", currentUid));
      const snap2 = await getDocs(q2);

      // Combine and remove duplicates
      const combined = new Map();
      snap1.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() }));
      snap2.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() }));

      setMyItems(Array.from(combined.values()));
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    }
  };

  // MODAL: Shows full details of an item
  const renderDetailModal = () => {
    if (!selectedItem) return null;

    const formatTime = (timeString) => {
      if (!timeString) return "";
      return timeString.substring(0, 5);
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
        <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-scale-up">

          <button
            onClick={() => setSelectedItem(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-white/20 transition-colors z-10"
          >
            <XCircle size={24} />
          </button>

          <div className="h-64 w-full bg-black flex items-center justify-center relative">
            {selectedItem.image ? (
              <img src={selectedItem.image} className="h-full w-full object-contain" />
            ) : (
              <div className="text-slate-700 flex flex-col items-center">
                <Camera size={48} />
                <span className="text-xs mt-2">No Image</span>
              </div>
            )}

            <div className="absolute bottom-4 left-4">
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase shadow-lg ${selectedItem.type === 'lost' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                {selectedItem.type} Report
              </span>
            </div>
          </div>

          <div className="p-6">

            {/* ✅ NEW SECTION: CLAIMANT INFO (Only visible to Finder) */}
            {selectedItem.status === 'claimed_pending' && selectedItem.uid === user.uid && (
              <div className="mb-6 bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-xl animate-pulse-slow">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="text-yellow-400" size={20} />
                  <h3 className="text-yellow-400 font-bold uppercase text-sm">Action Required: Claim Request</h3>
                </div>
                <div className="text-sm text-gray-300">
                  <p><span className="text-white font-bold">Claimant:</span> {selectedItem.claimantName || "Student"}</p>
                  <p className="mt-1"><span className="text-white font-bold">Phone:</span> {selectedItem.claimantPhone || "Not provided"}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <a
                    href={`tel:${selectedItem.claimantPhone}`}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 rounded-lg text-xs text-center flex items-center justify-center gap-2"
                  >
                    <Phone size={14} /> Call
                  </a>
                </div>
              </div>
            )}

            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-white">{selectedItem.name}</h2>
              <div className="text-right">
                <p className="text-sm text-gray-400">
                  {selectedItem.dateLostFound || new Date(selectedItem.createdAt?.seconds * 1000).toLocaleDateString()}
                </p>
                <p className="text-xs text-purple-400 font-mono font-bold">
                  {selectedItem.timeLostFound ? formatTime(selectedItem.timeLostFound) : "Time not set"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-1">Category</p>
                  <p className="text-white">{selectedItem.category}</p>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                  <p className="text-xs text-gray-400 uppercase font-bold mb-1">Location</p>
                  <p className="text-white flex items-center gap-1"><MapPin size={14} /> {selectedItem.location}</p>
                </div>
              </div>

              <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Description</p>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {selectedItem.description || "No description provided."}
                </p>
              </div>

              {selectedItem.type === 'found' && (
                <div className={`p-3 rounded-lg border ${selectedItem.custody === 'authority' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                  <p className="text-xs uppercase font-bold mb-1 flex items-center gap-2">
                    {selectedItem.custody === 'authority' ? <Shield size={14} className="text-blue-400" /> : <User size={14} className="text-green-400" />}
                    Current Location
                  </p>
                  <p className="text-white text-sm font-medium">
                    {selectedItem.custody === 'authority'
                      ? `Submitted to: ${selectedItem.authorityDetails}`
                      : "Item is with the Finder (Me)"}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // --- VIEWS ---

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-slate-950">
      <Card className="w-full max-w-md z-10">
        <h1 className="text-3xl font-bold text-white text-center mb-2">{CONFIG.appName}</h1>
        <p className="text-gray-400 text-center mb-6">Login to Access</p>
        <form onSubmit={handleLogin}>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} icon={Mail} />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} icon={Lock} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Login"}
          </Button>
        </form>
        <p className="mt-4 text-center text-gray-400 cursor-pointer" onClick={() => setActiveView('signup')}>
          New here? <span className="text-purple-400 font-bold">Sign Up</span>
        </p>
      </Card>
    </div>
  );

  const renderSignup = () => (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <Card className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-white text-center mb-6">Create Account</h1>
        <form onSubmit={handleSignup}>
          <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} icon={User} />
          <Input label="Phone (For matching)" value={phone} onChange={e => setPhone(e.target.value)} icon={Phone} />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} icon={Mail} />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} icon={Lock} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Sign Up"}
          </Button>
        </form>
        <p className="mt-4 text-center text-gray-400 cursor-pointer" onClick={() => setActiveView('login')}>
          Have account? <span className="text-purple-400 font-bold">Login</span>
        </p>
      </Card>
    </div>
  );

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
      <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-indigo-200 mb-6">
        {CONFIG.appName}
      </h1>
      <p className="text-xl text-gray-300 max-w-2xl mb-10">
        AI-Powered Lost & Found System. Upload an image to find matches.
      </p>
      <div className="flex gap-6">
        <Button onClick={() => setActiveView('reportLost')}>
          <Search size={20} /> I Lost Something
        </Button>
        <Button variant="secondary" onClick={() => setActiveView('reportFound')}>
          <Camera size={20} /> I Found Something
        </Button>
      </div>
    </div>
  );

  const renderForm = (type) => (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="flex items-center gap-4 mb-8 cursor-pointer" onClick={() => setActiveView('home')}>
        <ArrowRight className="rotate-180 text-white" />
        <h2 className="text-3xl font-bold text-white">{type === 'lost' ? 'Report Lost Item' : 'Report Found Item'}</h2>
      </div>
      <Card>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="col-span-2 flex flex-col items-center justify-center border-2 border-dashed border-slate-600 rounded-xl p-8 hover:bg-slate-800/50 transition-all relative overflow-hidden group">
            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImageUpload} accept="image/*" />

            {selectedImage ? (
              <img src={selectedImage} alt="Preview" className="h-48 object-cover rounded-lg" />
            ) : (
              <div className="text-center text-gray-400">
                <Upload size={40} className="mx-auto mb-2 group-hover:text-purple-400 transition-colors" />
                <p className="font-medium text-gray-300">Click to upload image</p>
                {/* ✅ ADDED THIS LINE: */}
                <p className="text-xs text-gray-500 mt-1">(Optional but highly recommended)</p>
              </div>
            )}
          </div>
          <Input
            label="Item Name"
            placeholder={type === 'lost' ? "e.g., Black Digital Watch" : "e.g., Dell Laptop Bag"}
            value={itemName}
            onChange={e => setItemName(e.target.value)}
          />
          <Select label="Category" options={CONFIG.categories} value={category} onChange={e => setCategory(e.target.value)} />
          <Select label="Location" options={CONFIG.locations} value={location} onChange={e => setLocation(e.target.value)} />
          {/* DATE AND TIME SECTION */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* 1. Date Picker */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Date {type === 'lost' ? 'Lost' : 'Found'}
              </label>
              <input
                type="date"
                // This forces the Calendar to pop up immediately when clicked anywhere in the box

                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 outline-none [color-scheme:dark] cursor-pointer"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* 2. Time Picker */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Time <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </label>
              <input
                type="time"
                // This forces the Clock/Spinner to pop up immediately
                onClick={(e) => e.target.showPicker()}
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 outline-none [color-scheme:dark] cursor-pointer"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            {/* Helper Text */}
            {type === 'lost' && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500">
                  * If unsure, please enter the probable date and time.
                </p>
              </div>
            )}
          </div>
          <div className="col-span-2">
            <Input
              label={<span>Description <span className="text-gray-500 text-xs font-normal">(Optional)</span></span>}
              placeholder="Mention scratches, stickers, brand name, or any unique identifiers..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          {/* CUSTODY SECTION (Only for Found Items) */}
          {type === 'found' && (
            <div className="col-span-2 bg-slate-800/50 p-4 rounded-xl border border-slate-600 mt-4">
              <label className="block text-gray-300 text-sm font-bold mb-3">Where is the item right now?</label>

              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="custody"
                    checked={custody === 'me'}
                    onChange={() => setCustody('me')}
                    className="accent-purple-500"
                  />
                  <span className="text-white">I have it with me</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="custody"
                    checked={custody === 'authority'}
                    onChange={() => setCustody('authority')}
                    className="accent-purple-500"
                  />
                  <span className="text-white">I submitted it to someone</span>
                </label>
              </div>

              {/* If submitted, ask WHERE */}
              {custody === 'authority' && (
                <div className="animate-fade-in-down">
                  <Input
                    label="Who has it?"
                    placeholder="e.g., Library Staff, Security Guard at Gate 1, Mosque Imam"
                    value={authorityDetails}
                    onChange={e => setAuthorityDetails(e.target.value)}
                    icon={Shield}
                    required
                  />
                  <p className="text-xs text-yellow-400 mt-[-10px]">
                    * We will direct the owner to this location.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => handleSubmitItem(type)} disabled={loading}>
            {loading ? "Processing..." : "Submit Report"}
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderMatches = () => (
    <div className="max-w-4xl mx-auto mt-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">Matches Found</h2>
        <Button variant="secondary" onClick={() => setActiveView('home')}>Back Home</Button>
      </div>

      {matches.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-gray-400">No exact matches found yet. We will notify you!</p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {matches.map((item) => (
            <div key={item.id} className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6 flex gap-6 items-center">
              {item.image && <img src={item.image} className="w-32 h-32 object-cover rounded-xl bg-slate-800" />}
              <div className="flex-1">
                <div className="flex justify-between">
                  <h3 className="text-2xl font-bold text-white">{item.name}</h3>
                  <span className="text-green-400 font-bold">{item.score}% Match</span>
                </div>
                <p className="text-gray-400 mt-2">{item.description}</p>
                <div className="flex gap-4 mt-4 text-sm text-gray-300">
                  <span className="flex items-center gap-1"><MapPin size={14} /> {item.location}</span>
                  <span className="flex items-center gap-1"><User size={14} /> Reported by: {item.userEmail}</span>
                </div>
                {/* SMART CUSTODY LOGIC */}
                {item.custody === 'authority' ? (
                  <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-yellow-500/30">
                    <p className="text-yellow-400 text-xs font-bold uppercase mb-1">Item Location</p>
                    <p className="text-white text-sm">
                      Submitted to: <span className="font-bold text-purple-300">{item.authorityDetails}</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-1">Please go there directly to collect it.</p>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleClaimItem(item.id)}
                    className="mt-4 py-2 text-sm"
                  >
                    Request Claim
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // THE IMPROVED DASHBOARD (Better Styling)
  const renderDashboard = () => {
    // Filters (Same logic as before)
    const lostItems = myItems.filter(i => i.type === 'lost' && i.uid === user.uid && i.status !== 'returned');
    const foundItems = myItems.filter(i => i.type === 'found' && i.uid === user.uid && i.status !== 'returned');
    const returnedItems = myItems.filter(i => i.uid === user.uid && i.status === 'returned');
    const myClaims = myItems.filter(i => i.claimedBy === user.uid);

    // Helper: Status Badge (Same as before)
    const StatusBadge = ({ status }) => {
      const styles = {
        open: "bg-blue-500/10 text-blue-400 border-blue-500/50",
        claimed_pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/50",
        returned: "bg-green-500/10 text-green-400 border-green-500/50",
      };
      return (
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${styles[status] || styles.open}`}>
          {status === 'returned' ? 'Resolved' : status.replace('_', ' ')}
        </span>
      );
    };

    return (
      <div className="max-w-7xl mx-auto mt-8 pb-20 px-4">

        {/* HEADER */}
        <div className="mb-10 border-b border-white/10 pb-6">
          <h2 className="text-4xl font-bold text-white mb-2">Dashboard</h2>
          <p className="text-gray-400">Welcome back. Here is your activity overview.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* 1. LOST ITEMS (Purple Theme) */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-purple-900/50 to-slate-900 p-4 border-l-4 border-purple-500 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="text-purple-400" /> My Lost Items
              </h3>
              <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-2 py-1 rounded-full">{lostItems.length} Active</span>
            </div>
            <div className="p-4 space-y-4 min-h-[200px]">
              {lostItems.length === 0 ? <p className="text-gray-600 text-center mt-10 italic">No active lost reports.</p> : (
                lostItems.map(item => (
                  <div key={item.id} className="bg-black/20 p-4 rounded-xl flex gap-4 items-center hover:bg-black/40 transition-colors">
                    <img src={item.image || "https://via.placeholder.com/50"} className="w-16 h-16 rounded-lg bg-slate-800 object-cover border border-white/10" />
                    <div className="flex-1">
                      <p className="font-bold text-white text-lg">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.location} • {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                      <div className="mt-2"><StatusBadge status={item.status} /></div>
                    </div>
                    {/* ACTION BUTTONS */}
                    <div className="flex gap-2">
                      {/* 1. I Got It Back (Green) */}
                      <button
                        onClick={() => handleOwnerReceived(item.id)}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg border border-green-500/30 transition-colors"
                        title="I got it back / Case Solved"
                      >
                        <CheckCircle size={20} />
                      </button>

                      {/* 2. Delete (Red) */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. FOUND ITEMS (Blue Theme) */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-blue-900/50 to-slate-900 p-4 border-l-4 border-blue-500 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Camera className="text-blue-400" /> My Found Items
              </h3>
              <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-1 rounded-full">{foundItems.length} Active</span>
            </div>
            <div className="p-4 space-y-4 min-h-[200px]">
              {foundItems.length === 0 ? <p className="text-gray-600 text-center mt-10 italic">No active found reports.</p> : (
                foundItems.map(item => (
                  <div key={item.id} className="bg-black/20 p-4 rounded-xl flex items-center justify-between gap-4 hover:bg-black/30 transition-colors border border-white/5">
                    
                    {/* LEFT SIDE: Image & Text */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Image */}
                      <img src={item.image || "https://via.placeholder.com/50"} className="w-14 h-14 rounded-lg bg-slate-800 object-cover border border-white/10 shrink-0"/>
                      
                      {/* Text Info */}
                      <div className="min-w-0">
                        <p className="font-bold text-white text-lg truncate">{item.name}</p>
                        <p className="text-sm text-gray-500 truncate">{item.location}</p>
                        
                        {/* ✅ THE CLEAN YELLOW BADGE (Pill Shape) */}
                        {item.status === 'claimed_pending' && (
                          <button 
                            onClick={() => setSelectedItem(item)}
                            className="mt-1.5 group flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full hover:bg-yellow-500/20 transition-all w-fit cursor-pointer"
                          >
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                            </span>
                            <span className="text-[10px] font-bold text-yellow-100 uppercase tracking-wide">
                              Claim Requested
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* RIGHT SIDE: Action Buttons (Horizontal Row) */}
                    <div className="flex items-center gap-2 shrink-0">
                       
                       {/* 1. Main Action: Return/Confirm */}
                       {item.status !== 'returned' && (
                        <button 
                          onClick={() => handleMarkReturned(item)} 
                          className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap shadow-lg ${
                            item.custody === 'authority' 
                              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20" 
                              : "bg-green-600 hover:bg-green-500 text-white shadow-green-900/20"
                          }`}
                        >
                          {item.custody === 'authority' ? "Confirm Sub." : "Mark Returned"}
                        </button>
                      )}

                      {/* 2. ✅ RESTORED EYE ICON (View Details) */}
                      <button 
                        onClick={() => setSelectedItem(item)} 
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="View Full Details"
                      >
                        <Eye size={18}/>
                      </button>
                      
                      {/* 3. Trash Icon */}
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Report"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. CLAIMS (Yellow Theme) */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-yellow-900/30 to-slate-900 p-4 border-l-4 border-yellow-500">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="text-yellow-400" /> Pending Claims
              </h3>
            </div>
            <div className="p-4">
              {myClaims.length === 0 ? <p className="text-gray-600 text-sm">You aren't claiming anything right now.</p> : (
                myClaims.map(item => (
                  <div key={item.id} className="bg-black/20 p-3 rounded-xl flex gap-3 items-center mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-white">Claiming: {item.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                        <User size={14} /> Finder: {item.userEmail}
                      </div>
                      <div className="mt-2"><StatusBadge status={item.status} /></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. HISTORY (Green/Gray Theme) */}
          <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-green-900/30 to-slate-900 p-4 border-l-4 border-green-600">
              <h3 className="text-xl font-bold text-gray-300 flex items-center gap-2">
                <CheckCircle className="text-green-500" /> Resolved History
              </h3>
            </div>
            {/* CONTENT AREA */}
            <div className="p-4 space-y-4">
               {returnedItems.length === 0 ? <p className="text-gray-600 text-center mt-4 text-sm">No resolved cases yet.</p> : (
                 returnedItems.map(item => (
                  <div key={item.id} className="bg-black/20 p-4 rounded-xl flex items-center gap-4 border border-white/5 opacity-75 hover:opacity-100 transition-opacity">
                    
                    {/* BIGGER IMAGE */}
                    <img src={item.image || "https://via.placeholder.com/50"} className="w-14 h-14 rounded-lg bg-slate-800 object-cover grayscale opacity-60 border border-white/5"/>
                    
                    {/* TEXT CONTENT */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-400 text-lg truncate">{item.name}</p>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold bg-green-500/10 text-green-500 px-2 py-0.5 rounded border border-green-500/20 uppercase">
                          Returned
                        </span>
                        <span className="text-xs text-gray-600">
                           • {new Date(item.returnedAt?.seconds * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
               )}
            </div>
          </div>

        </div>
      </div>
    );
  };

  // --- RENDER CONTROL ---
  if (activeView === 'login') return renderLogin();
  if (activeView === 'signup') return renderSignup();

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20">
      <nav className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl flex items-center gap-2" onClick={() => setActiveView('home')}>
            <Search className="text-purple-500" /> {CONFIG.appName}
          </div>
          <div className="flex gap-4 items-center">
            <span className="text-sm text-gray-400 hidden md:block">Hi, {user?.email}</span>
            {/* DASHBOARD BUTTON */}
            <Button
              variant="secondary"
              className="relative py-1 px-4 text-sm bg-purple-500/10 text-purple-300 border-purple-500/50 hover:bg-purple-500/20"
              onClick={() => {
                setActiveView('dashboard');
                setNotificationsRead(true); // ✅ Mark as read when clicked
              }}
            >
              <BarChart3 size={14} /> Dashboard

              {/* BADGE LOGIC: Show only if count > 0 AND not read yet */}
              {pendingClaimsCount > 0 && !notificationsRead && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-950 animate-bounce shadow-lg shadow-red-500/50">
                  {pendingClaimsCount}
                </span>
              )}
            </Button>
            <Button variant="secondary" className="py-1 px-4 text-sm" onClick={handleLogout}><LogOut size={14} /> Logout</Button>
          </div>
        </div>
      </nav>
      <main className="px-4">
        {activeView === 'home' && renderHome()}
        {activeView === 'reportLost' && renderForm('lost')}
        {activeView === 'reportFound' && renderForm('found')}
        {activeView === 'matches' && renderMatches()}
        {activeView === 'dashboard' && renderDashboard()}
      </main>
      {/* ✅ This line here make the modal sits on top of everything */}
      {renderDetailModal()}
    </div>
  );
}