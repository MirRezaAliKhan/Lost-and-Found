import React, { useState, useEffect } from 'react';
import {
  Search, Upload, MapPin, Calendar, Camera,
  CheckCircle, XCircle, Shield, User, Menu,
  BarChart3, Eye, LogOut, ArrowRight, Phone, Mail, Lock, Loader2, Trash2, Home, EyeOff
} from 'lucide-react';

// FIREBASE IMPORTS
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { initGenAI, getEmbedding, findMatchesAI } from './aiMatch';


// ==========================================
// 1. CONFIGURATION
// ==========================================
const CONFIG = {
  appName: "Lost-N-Found",
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

const Input = ({ label, type = "text", placeholder, icon: Icon, value, onChange, required, disabled }) => {
  // Local state to toggle visibility
  const [showPassword, setShowPassword] = useState(false);

  // Decide: Should we show text or dots?
  // If it's not a password field, just use the normal type.
  // If it IS a password field, toggle based on state.
  const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="mb-4">
      <label className="block text-gray-300 text-sm font-medium mb-2">{label}</label>
      <div className="relative">

        {/* LEFT ICON (Lock/User/etc) */}
        {Icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
            <Icon size={18} />
          </div>
        )}

        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          // Added 'pr-10' (padding-right) so text doesn't hit the eye icon
          className={`w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all ${Icon ? 'pl-10' : ''} ${type === 'password' ? 'pr-10' : ''}`}
        />

        {/* RIGHT ICON (Show/Hide Toggle) - Only for password inputs */}
        {type === 'password' && (
          <button
            type="button" // Important: Prevent form submission
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer focus:outline-none"
            tabIndex="-1" // Skip tabbing to this button for speed
          >
            {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}

      </div>
    </div>
  );
};

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

  // App Loading State (Prevents flicker)
  const [isInitializing, setIsInitializing] = useState(true);

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
  const [customLocation, setCustomLocation] = useState(''); // For manual location entry

  // New State for "Custody" logic
  const [custody, setCustody] = useState('me'); // Options: 'me' or 'authority'
  const [authorityDetails, setAuthorityDetails] = useState(''); // e.g., "Library Staff"

  // Date & Time State
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Toggle between viewing and editing profile
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Dashboard Data
  const [myItems, setMyItems] = useState([]);

  // ADMIN STATE
  const [adminItems, setAdminItems] = useState([]);
  const [adminStats, setAdminStats] = useState({ lost: 0, found: 0, returned: 0 });

  // ✅ ADD THIS BLOCK: Auto-Recalculate Stats whenever items change
  useEffect(() => {
    let l = 0, f = 0, r = 0;

    adminItems.forEach((item) => {
      if (item.status === 'returned') r++;
      else if (item.type === 'lost') l++;
      else if (item.type === 'found') f++;
    });

    setAdminStats({ lost: l, found: f, returned: r });
  }, [adminItems]); // <--- The dependency array: Runs every time 'adminItems' changes

  // Temporary state for editing (prevents navbar from updating while typing)
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // CALCULATION: How many people are waiting for ME?
  // Logic: Items I Found (i.uid === user.uid) AND Status is 'claimed_pending'
  // ✅ FIX: Check if 'user' exists before asking for 'user.uid'
  const pendingClaimsCount = user ? myItems.filter(i =>
    i.type === 'found' &&
    i.uid === user.uid &&
    i.status === 'claimed_pending'
  ).length : 0;

  // EFFECT: If the number of claims changes (new claim arrives), show badge again
  useEffect(() => {
    if (pendingClaimsCount > 0) {
      setNotificationsRead(false);
    }
  }, [pendingClaimsCount]);

  // AUTH LISTENER (Role-Based Persistence)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {

      if (currentUser) {
        // User found! Check if they are Admin or Student
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists() && userSnap.data().role === 'admin') {
            // ✅ IT IS THE ADMIN
            await fetchAdminData();
            setActiveView('admin');
          } else {
            // ✅ IT IS A STUDENT
            setUser(currentUser);
            if (userSnap.exists()) {
              const data = userSnap.data();
              setName(data.name || "");
              setPhone(data.phone || "");
            }
            fetchMyItems(currentUser.uid);

            // Only go to home if we are currently on a login/loading screen
            if (activeView === 'login' || activeView === 'admin' || isInitializing) {
              setActiveView('home');
            }
          }
        } catch (error) {
          console.error("Auth check error:", error);
        }
      } else {
        // No user logged in
        setUser(null);
        setAdminItems([]);
        setActiveView('login');
      }

      setIsInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  // INITIALIZE GEMINI AI
  useEffect(() => {
    const key = import.meta.env.VITE_GEMINI_KEY;
    if (key) {
      initGenAI(key);
      console.log("✨ Gemini AI Initialized");
    } else {
      console.warn("⚠️ VITE_GEMINI_KEY is missing in .env");
    }
  }, []);

  // --- ACTIONS ---

  const handleSignup = async (e) => {
    e.preventDefault();

    // ✅ VALIDATION: Check Phone Length
    if (phone.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create Auth User (Email/Password)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid; // Get the specific User ID

      // ✅ THE FIX: Use 'setDoc' to force the Document ID to match the User UID
      // This way, we can easily find it later using 'doc(db, "users", uid)'
      await setDoc(doc(db, "users", uid), {
        uid: uid,
        name: name,
        phone: phone,
        email: email,
        createdAt: serverTimestamp()
      });

      // Update local state immediately so UI updates
      setUser(userCredential.user);

      alert("Account Created Successfully!");
      setActiveView('home');
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
    setLoading(false);
  };

  // ACTION: Update User Profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    // ✅ VALIDATION 1: Check Empty Name
    if (!editName.trim()) {
      alert("Name cannot be empty.");
      return;
    }

    //  Validation Logic
    // We check 'editPhone' (the temp variable)
    if (editPhone.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return; // 🛑 THIS STOPS THE FUNCTION HERE. It won't save.
    }

    setLoading(true);
    try {
      // Save the TEMP data to the database
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: editName,   // Save the new name
        phone: editPhone, // Save the new phone
        email: user.email,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // ✅ Now update the GLOBAL state (so Navbar updates only now)
      setName(editName);
      setPhone(editPhone);

      alert("Profile updated successfully!");

      // ✅ BUG FIX 2: Stay on Profile, just exit Edit Mode
      setIsEditingProfile(false);

    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Log in via Firebase Auth (Works for Admin AND Students)
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 2. Check the Database for the "Secret Badge"
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);

      let isAdmin = false;
      let userData = {};

      if (userSnap.exists()) {
        userData = userSnap.data();
        if (userData.role === 'admin') {
          isAdmin = true;
        }
      }

      // 3. Route them based on Role
      if (isAdmin) {
        console.log("Admin detected. Loading console...");
        await fetchAdminData();
        setActiveView('admin');
      } else {
        console.log("Student detected. Loading home...");
        setUser(userCredential.user);
        setName(userData.name || "");
        setPhone(userData.phone || "");
        setActiveView('home');
      }

    } catch (error) {
      console.error("Login Error:", error);
      alert("Invalid Email or Password");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to log out?")) {
      setLoading(true);
      signOut(auth).then(() => {
        // Wipe local state
        setUser(null);
        setName('');
        setPhone('');
        setMyItems([]);
        setAdminItems([]);

        // ✅ NEW: Wipe the Form Inputs too!
        setEmail('');
        setPassword('');

        setActiveView('login');
        setLoading(false);
      });
    }
  };

  // HELPER: Clear all form fields
  const resetForm = () => {
    setItemName('');
    setCategory('');
    setLocation('');
    setCustomLocation('');
    setDescription('');
    setSelectedImage(null);
    setDate('');
    setTime('');
    setAuthorityDetails(''); // ✅ Add this
    setCustody('me');        // ✅ Add this
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await convertToBase64(file);
      setSelectedImage(base64);
    }
  };

  // ACTION: User claims an item (ROBUST VERSION)
  const handleClaimItem = async (itemId) => {
    if (confirm("Send a claim request to the finder? They will see your phone number.")) {
      try {
        // 1. Fetch the LATEST details directly from Database
        // This ensures we get the real name/phone even if the app memory is empty
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        let currentName = "Anonymous Student";
        let currentPhone = "No Phone Provided";

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.name) currentName = userData.name;
          if (userData.phone) currentPhone = userData.phone;
        }

        // 2. Submit the claim with the FRESH data
        const itemRef = doc(db, "items", itemId);
        await updateDoc(itemRef, {
          status: 'claimed_pending',
          claimedBy: user.uid,
          claimantName: currentName,
          claimantPhone: currentPhone
        });

        await fetchMyItems(user.uid);
        alert("Claim request sent! Check your dashboard.");
        setActiveView('dashboard');

      } catch (error) {
        console.error("Error claiming:", error);
        alert("Could not send claim. Check your connection.");
      }
    }
  };

  // ACTION: User cancels their own claim request
  const handleCancelClaim = async (itemId) => {
    if (confirm("Are you sure you want to cancel this claim request?")) {
      try {
        const itemRef = doc(db, "items", itemId);

        // Reset the item back to 'open' state
        await updateDoc(itemRef, {
          status: 'open',
          claimedBy: "",      // Clear these fields
          claimantName: "",
          claimantPhone: ""
        });

        await fetchMyItems(user.uid);
        alert("Claim request cancelled.");

      } catch (error) {
        console.error("Error cancelling claim:", error);
        alert("Error cancelling claim");
      }
    }
  };

  // ACTION: Finder marks item as returned
  // ACTION: Close the case (Either returned to owner OR submitted to staff)
  const handleMarkReturned = async (item) => {
    let details = "";
    // ✅ 1. Default status is 'returned'
    let newStatus = 'returned'; 

    // CASE 1: You said earlier that you gave it to Authority (Library/Guard)
    if (item.custody === 'authority') {
      if (!confirm(`Confirm that you have successfully submitted this item to: ${item.authorityDetails}?`)) {
        return;
      }
      details = `Submitted to: ${item.authorityDetails}`;
      // ✅ 2. Change status to 'submitted' for authority cases
      newStatus = 'submitted'; 
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
        // ✅ 3. USE THE VARIABLE (Not hardcoded 'returned')
        status: newStatus, 
        returnedAt: serverTimestamp(),
        handoverDetails: details 
      });
      
      await fetchMyItems(user.uid);
      alert("Report updated successfully!");

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
    // 1. DETERMINE FINAL LOCATION
    // If "Others" is selected, use the custom text. Otherwise use the dropdown value.
    const finalLocation = location === 'Others' ? customLocation : location;

    // 2. VALIDATION (Check finalLocation instead of just location)
    if (!itemName || !category || !finalLocation || !date) {
      alert("Please fill in all required fields.");
      return;
    }
    setLoading(true);

    try {
      const itemData = {
        name: itemName,
        category,
        location: finalLocation, // ✅ SAVE THE REAL TEXT
        description,
        image: selectedImage,
        type: type,
        uid: user.uid,
        userEmail: user.email,

        userName: name || "Anonymous",
        userPhone: phone || "No Phone",

        status: 'open',
        createdAt: serverTimestamp(),
        dateLostFound: date,
        timeLostFound: time,
        custody: type === 'found' ? custody : 'me',
        authorityDetails: type === 'found' ? authorityDetails : ''
      };

      // ... (Rest of the function remains the same: addDoc, fetchMyItems, etc.) ...

      // 3. GENERATE AI EMBEDDING (Only for Found Items)
      if (type === 'found') {
        const textToEmbed = `${itemName} ${category} ${description} ${finalLocation}`;
        console.log("Generating embedding for:", textToEmbed);
        const embedding = await getEmbedding(textToEmbed);
        if (embedding) {
          itemData.embedding = embedding;
          console.log("✅ Embedding generated!");
        }
      }

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
      setDate(''); setTime(''); setCustomLocation(''); // Reset new fields
      // ✅ ADD THESE TWO LINES TO FIX THE BUG
      setAuthorityDetails(''); 
      setCustody('me'); // Reset radio button to default
    } catch (error) {
      console.error(error);
      alert("Error saving item");
    }
    setLoading(false);
  };

  // THE ROBUST MATCHING LOGIC (AI POWERED)
  const findMatches = async (searchName, searchCategory, searchLocation) => {
    setLoading(true);

    // Check if API key exists, if not fallback to old logic (or just show alert)
    if (!import.meta.env.VITE_GEMINI_KEY) {
      alert("AI Matching is disabled (Missing API Key). Using basic search.");
      // ... (You could keep the old logic here as fallback, but for this task we switch to AI)
    }

    try {
      // Use the new AI Helper
      const aiResults = await findMatchesAI(searchName, searchCategory, searchLocation, user.uid);
      setMatches(aiResults);

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

  // ADMIN: Fetch ALL data
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // Order by newest first
      const q = query(collection(db, "items"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const allItems = [];
      let l = 0, f = 0, r = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        allItems.push({ id: doc.id, ...data });

        // Calculate Stats
        if (data.status === 'returned') r++;
        else if (data.type === 'lost') l++;
        else if (data.type === 'found') f++;
      });

      setAdminItems(allItems);
      setAdminStats({ lost: l, found: f, returned: r });
    } catch (error) {
      console.error("Admin Error:", error);
    }
    setLoading(false);
  };

  // ADMIN: Delete Action
  const handleAdminDelete = async (id) => {
    if (confirm("ADMIN WARNING: This will permanently delete this item. Continue?")) {
      await deleteDoc(doc(db, "items", id));
      setAdminItems(prev => prev.filter(item => item.id !== id));
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

  const renderProfile = () => (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950 relative">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-900/20 rounded-full blur-[100px]"></div>
      </div>

      <Card className="w-full max-w-md relative border border-white/10 bg-slate-900/90 backdrop-blur-xl">

        {/* Header: Title + Close Button */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white">My Profile</h2>
          <button
            onClick={() => {
              setActiveView('home');
              setIsEditingProfile(false); // Reset to view mode when closing
            }}
            className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <XCircle size={28} />
          </button>
        </div>

        {/* ==========================
            MODE 1: VIEW DETAILS
           ========================== */}
        {!isEditingProfile ? (
          <div className="text-center animate-fade-in">
            {/* Big Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-900/20">
              <span className="text-4xl font-bold text-white">
                {name ? name.charAt(0).toUpperCase() : "U"}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-white mb-8">{name || "User Name"}</h3>

            {/* Info Card */}
            <div className="bg-slate-800/50 rounded-xl p-4 text-left border border-white/5 mb-8">
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Phone Number</p>
                <div className="flex items-center gap-3 text-white">
                  <Phone size={18} className="text-purple-400" />
                  <span className="font-mono text-lg">{phone || "Not set"}</span>
                </div>
              </div>
              <div className="h-px bg-white/5 my-3"></div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Email Address</p>
                <div className="flex items-center gap-3 text-white">
                  <Mail size={18} className="text-blue-400" />
                  <span className="text-sm font-medium">{user?.email}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setEditName(name);   // Copy current name to temp
                setEditPhone(phone); // Copy current phone to temp
                setIsEditingProfile(true);
              }}
              className="w-full"
            >
              Edit Details
            </Button>
          </div>
        ) : (
          /* ==========================
             MODE 2: EDIT FORM
             ========================== */
          <form onSubmit={(e) => { handleUpdateProfile(e); setIsEditingProfile(false); }} className="animate-fade-in">

            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl mb-6 flex items-start gap-3">
              <User className="text-blue-400 shrink-0 mt-1" />
              <div>
                <p className="text-blue-200 text-sm font-bold">Editing Profile</p>
                <p className="text-blue-300/70 text-xs mt-1">
                  Ensure your phone number is correct so finders can reach you.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <Input
                label="Full Name"
                placeholder="Your Name"
                value={editName} // ✅ Uses temp variable
                onChange={e => setEditName(e.target.value)}
                icon={User}
              />
              <Input
                label="Phone Number"
                placeholder="9876543210"
                value={editPhone} // ✅ Uses temp variable
                onChange={(e) => {
                  const onlyNums = e.target.value.replace(/[^0-9]/g, '');
                  if (onlyNums.length <= 10) {
                    setEditPhone(onlyNums);
                  }
                }}
                icon={Phone}
              />
              {/* Email remains read-only */}
              <div className="opacity-50 pointer-events-none">
                <Input label="Email (Cannot change)" value={user?.email} icon={Mail} disabled={true} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleCancelProfile} // ✅ UPDATED: Uses the revert logic
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );

  // ACTION: Cancel editing and revert changes
  const handleCancelProfile = async () => {
    setLoading(true);
    try {
      // Fetch the REAL data from database to overwrite what you typed
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setName(data.name || "");
        setPhone(data.phone || "");
      }
      setIsEditingProfile(false); // Close the edit mode
    } catch (error) {
      console.error("Error reverting profile:", error);
    }
    setLoading(false);
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
        <p className="mt-6 text-center text-gray-400 text-sm">
          Don't have an account?{' '}
          <button
            onClick={() => {
              // ✅ CLEAR FIELDS BEFORE SWITCHING
              setEmail('');
              setPassword('');
              setName('');
              setPhone('');
              setActiveView('signup');
            }}
            className="text-purple-400 font-bold hover:text-purple-300 hover:underline"
          >
            Sign Up
          </button>
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
          {/* PHONE INPUT (With Restrictions) */}
          <Input
            label="Phone Number"
            type="tel"
            placeholder="9876543210"
            icon={Phone}
            value={phone}
            onChange={(e) => {
              // ✅ Logic: Only allow numbers, max 10 digits
              const onlyNums = e.target.value.replace(/[^0-9]/g, '');
              if (onlyNums.length <= 10) {
                setPhone(onlyNums);
              }
            }}
          />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} icon={Mail} />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} icon={Lock} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Sign Up"}
          </Button>
        </form>
        <p className="mt-6 text-center text-gray-400 text-sm">
          Already have an account?{' '}
          <button
            onClick={() => {
              // ✅ CLEAR ALL FIELDS
              setEmail('');
              setPassword('');
              setName('');
              setPhone('');

              // ✅ THEN SWITCH VIEW
              setActiveView('login');
            }}
            className="text-purple-400 font-bold hover:text-purple-300 hover:underline cursor-pointer"
          >
            Login
          </button>
        </p>
      </Card>
    </div>
  );

  const renderHome = () => (
    // ✅ FIXED HEIGHT: Adjusted to account for navbar + global padding so no scrollbar appears
    <div className="h-[calc(100vh-10rem)] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* HERO SECTION */}
      {/* ✅ LIFTED UP: Changed mt-[-5vh] to mt-[-15vh] */}
      <div className="text-center z-10 mt-[-15vh]">
        <h1 className="text-6xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-indigo-200 mb-6 drop-shadow-lg">
          {CONFIG.appName}
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          AI-Powered Object Recovery System. Upload an image, and our smart algorithms will find matches instantly.
        </p>

        <div className="flex justify-center gap-6">
          <Button
            onClick={() => {
              resetForm();
              setActiveView('reportLost');
            }}
            className="shadow-purple-500/20 shadow-lg"
          >
            <Search size={20} /> I Lost Something
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              resetForm();
              setActiveView('reportFound');
            }}
          >
            <Camera size={20} /> I Found Something
          </Button>
        </div>
      </div>

      {/* FEATURE CARDS (Anchored at Bottom) */}
      {/* Adjusted bottom position slightly */}
      <div className="absolute bottom-4 w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 px-4">

        {/* Card 1 */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl flex items-center gap-4 hover:bg-slate-800/60 transition-colors cursor-default">
          <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
            <Eye size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Smart AI</h3>
            <p className="text-gray-400 text-xs mt-0.5">Automatic text recognition</p>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl flex items-center gap-4 hover:bg-slate-800/60 transition-colors cursor-default">
          <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Secure Custody</h3>
            <p className="text-gray-400 text-xs mt-0.5">Track item handover chain</p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-5 rounded-2xl flex items-center gap-4 hover:bg-slate-800/60 transition-colors cursor-default">
          <div className="p-3 bg-green-500/20 rounded-xl text-green-400">
            <Phone size={24} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Instant Connect</h3>
            <p className="text-gray-400 text-xs mt-0.5">Direct contact with finders</p>
          </div>
        </div>

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
          {/* DYNAMIC LOCATION SELECT */}
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-2">Location</label>
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="" disabled>Select an option</option>
              {CONFIG.locations
                // ✅ LOGIC: Remove 'Not Sure' if reporting a Found Item
                .filter(loc => type === 'found' ? loc !== 'Not Sure' : true)
                .map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))
              }
            </select>

            {/* ✅ CONDITIONAL INPUT: Show only if 'Others' is selected */}
            {location === 'Others' && (
              <div className="animate-fade-in-down mt-4">
                <Input
                  label="Specify Location"
                  placeholder="e.g., Mosque , Admission Cell"
                  value={customLocation}
                  onChange={e => setCustomLocation(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {/* DATE AND TIME SECTION (Stable Full Width) */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4 mb-4">

            {/* 1. Date Picker */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Date {type === 'lost' ? 'Lost' : 'Found'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 outline-none [color-scheme:dark] cursor-pointer"
                required
              />
            </div>

            {/* 2. Time Picker */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Time <span className="text-gray-500 text-xs font-normal">(Optional)</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 outline-none [color-scheme:dark] cursor-pointer"
              />
            </div>

            {/* Helper Text (Now visible for BOTH Lost & Found) */}
            <div className="col-span-2">
              <p className="text-xs text-gray-500">
                * If unsure, please enter the probable date and time.
              </p>
            </div>
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
      {/* HEADER WITH BACK BUTTON */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">

          {/* ✅ NEW BACK BUTTON (Points to Dashboard) */}
          <button
            onClick={() => setActiveView('dashboard')}
            className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-gray-400 hover:text-white border border-white/10"
            title="Back to Dashboard"
          >
            <ArrowRight className="rotate-180" size={20} />
          </button>

          <h2 className="text-3xl font-bold text-white">Matches Found</h2>
        </div>

        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 uppercase tracking-wider">
          Live Results
        </span>
      </div>

      {matches.length === 0 ? (
        <Card className="text-center py-10">
          <p className="text-gray-400">No exact matches found yet. We will notify you!</p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {matches.map((item) => (
            <div key={item.id} className="bg-slate-900/80 border border-purple-500/30 rounded-2xl p-6 flex gap-6 items-center">
              {/* CLICKABLE IMAGE (Opens Modal) */}
              {/* CLICKABLE IMAGE / PLACEHOLDER (With Hover Effect) */}
              <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => setSelectedItem(item)}
                title="Click to view details"
              >
                {/* 1. THE CONTENT (Image or Placeholder) */}
                {item.image ? (
                  <img src={item.image} className="w-32 h-32 object-cover rounded-xl bg-slate-800 border border-white/10 group-hover:opacity-50 transition-opacity" />
                ) : (
                  <div className="w-32 h-32 bg-slate-800 rounded-xl flex items-center justify-center border border-white/10 group-hover:opacity-50 transition-opacity">
                    <Camera size={30} className="text-slate-600" />
                  </div>
                )}

                {/* 2. THE HOVER OVERLAY (Appears on TOP of either) */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="text-white drop-shadow-lg" size={30} />
                </div>
              </div>
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
                {/* SMART ACTION LOGIC */}
                {item.claimedBy === user.uid ? (
                  /* CASE 1: ALREADY CLAIMED (Green Badge) */
                  <div className="mt-4 w-full flex items-center justify-center gap-2 text-green-400 bg-green-500/10 p-2 rounded-lg border border-green-500/20">
                    <CheckCircle size={16} />
                    <span className="text-xs font-bold uppercase">Already Claimed</span>
                  </div>
                ) : item.custody === 'authority' ? (
                  /* CASE 2: ITEM IS AT AUTHORITY (Yellow Box) */
                  <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-yellow-500/30">
                    <p className="text-yellow-400 text-xs font-bold uppercase mb-1">Item Location</p>
                    <p className="text-white text-sm">
                      Submitted to: <span className="font-bold text-purple-300">{item.authorityDetails}</span>
                    </p>
                    <p className="text-gray-400 text-xs mt-1">Please go there directly to collect it.</p>
                  </div>
                ) : (
                  /* CASE 3: STANDARD CLAIM (Just the Button) */
                  <Button
                    onClick={() => handleClaimItem(item.id)}
                    className="mt-4 py-2 text-sm w-full"
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
    // FILTERS UPDATE:
    // 1. Lost Items: Keep showing until I get them back ('returned')
    const lostItems = myItems.filter(i => i.type === 'lost' && i.uid === user.uid && i.status !== 'returned');
    
    // 2. Found Items: Show only if I still have them. 
    // If 'returned' OR 'submitted', they move to history.
    const foundItems = myItems.filter(i => i.type === 'found' && i.uid === user.uid && i.status !== 'returned' && i.status !== 'submitted');
    
    // 3. History: Show items that are 'returned' OR 'submitted'
    const returnedItems = myItems.filter(i => i.uid === user.uid && (i.status === 'returned' || i.status === 'submitted'));
    
    const myClaims = myItems.filter(i => i.claimedBy === user.uid);

    // Helper: Status Badge (Updated for 'submitted')
    const StatusBadge = ({ status }) => {
      const styles = {
        open: "bg-blue-500/10 text-blue-400 border-blue-500/50",
        claimed_pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/50",
        returned: "bg-green-500/10 text-green-400 border-green-500/50",
        submitted: "bg-purple-500/10 text-purple-400 border-purple-500/50", // ✅ New Badge Style
      };
      return (
        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${styles[status] || styles.open}`}>
          {status === 'returned' ? 'Resolved' : status === 'submitted' ? 'Submitted' : status.replace('_', ' ')}
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
                    {/* IMAGE OR PLACEHOLDER */}
                    {item.image ? (
                      <img src={item.image} className="w-16 h-16 rounded-lg bg-slate-800 object-cover border border-white/10" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                        <Camera size={24} className="text-slate-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-white text-lg">{item.name}</p>
                      <p className="text-sm text-gray-500">{item.location} • {new Date(item.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                      <div className="mt-2"><StatusBadge status={item.status} /></div>
                    </div>
                    {/* ACTION BUTTONS */}
                    {/* ACTION BUTTONS */}
                    <div className="flex gap-2">

                      {/* 1. NEW: Check Matches (Purple) */}
                      <button
                        onClick={() => {
                          findMatches(item.name, item.category, item.location);
                          setActiveView('matches');
                        }}
                        className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg border border-purple-500/30 transition-colors"
                        title="Search for Matches"
                      >
                        <Search size={20} />
                      </button>

                      {/* 2. I Got It Back (Green) */}
                      <button
                        onClick={() => handleOwnerReceived(item.id)}
                        className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg border border-green-500/30 transition-colors"
                        title="I got it back / Case Solved"
                      >
                        <CheckCircle size={20} />
                      </button>

                      {/* 3. Delete (Red) */}
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

                      {/* ✅ IMAGE OR PLACEHOLDER LOGIC */}
                      <div className="shrink-0">
                        {item.image ? (
                          <img src={item.image} className="w-16 h-16 rounded-lg bg-slate-800 object-cover border border-white/10" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center">
                            <Camera size={24} className="text-slate-600" />
                          </div>
                        )}
                      </div>

                      {/* Text Info */}
                      <div className="min-w-0">
                        <p className="font-bold text-white text-lg truncate">{item.name}</p>
                        <p className="text-sm text-gray-500 truncate">{item.location}</p>

                        {/* CLEAN YELLOW BADGE */}
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
                              CLAIM REQUESTED
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* RIGHT SIDE: Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">

                      {/* 1. Main Action */}
                      {item.status !== 'returned' && (
                        <button
                          onClick={() => handleMarkReturned(item)}
                          className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap shadow-lg ${item.custody === 'authority'
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
                            : "bg-green-600 hover:bg-green-500 text-white shadow-green-900/20"
                            }`}
                        >
                          {item.custody === 'authority' ? "Confirm Sub." : "Mark Returned"}
                        </button>
                      )}

                      {/* 2. Eye Icon */}
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="View Full Details"
                      >
                        <Eye size={18} />
                      </button>

                      {/* 3. Trash Icon */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete Report"
                      >
                        <Trash2 size={18} />
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
                  <div key={item.id} className="bg-black/20 p-3 rounded-xl flex gap-3 items-center mb-3 border border-white/5">

                    {/* INFO */}
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">Claiming: {item.name}</p>
                      <p className="text-xs text-gray-400">Finder Contact: {item.userEmail}</p>
                      <div className="mt-1"><StatusBadge status={item.status} /></div>
                    </div>

                    {/* CANCEL BUTTON (Only if not yet resolved) */}
                    {item.status !== 'returned' && (
                      <button
                        onClick={() => handleCancelClaim(item.id)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Withdraw Claim"
                      >
                        Cancel
                      </button>
                    )}
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
                  <div key={item.id} className="bg-black/20 p-4 rounded-xl flex items-center gap-4 border border-white/5">

                    {/* IMAGE OR PLACEHOLDER (Full Color & Bright) */}
                    <div className="shrink-0">
                      {item.image ? (
                        <img src={item.image} className="w-14 h-14 rounded-lg bg-slate-800 object-cover border border-white/5" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center shrink-0">
                          <Camera size={20} className="text-slate-600" />
                        </div>
                      )}
                    </div>

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

  const renderAdmin = () => (
    <div className="min-h-screen bg-slate-950 p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-red-500 tracking-wider">ADMIN CONSOLE</h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest">Authorized Personnel Only</p>
        </div>
        <button onClick={() => setActiveView('login')} className="flex items-center gap-2 text-gray-400 hover:text-white bg-white/5 px-4 py-2 rounded-lg transition-colors border border-white/10">
          <LogOut size={18} /> Exit System
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8 max-w-7xl mx-auto">
        <div className="bg-purple-900/20 border border-purple-500/30 p-6 rounded-xl text-center">
          <h3 className="text-purple-400 text-xs font-bold uppercase mb-2">Total Lost</h3>
          <p className="text-4xl font-bold text-white">{adminStats.lost}</p>
        </div>
        <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-xl text-center">
          <h3 className="text-blue-400 text-xs font-bold uppercase mb-2">Total Found</h3>
          <p className="text-4xl font-bold text-white">{adminStats.found}</p>
        </div>
        <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-xl text-center">
          <h3 className="text-green-400 text-xs font-bold uppercase mb-2">Resolved</h3>
          <p className="text-4xl font-bold text-white">{adminStats.returned}</p>
        </div>
      </div>

      {/* Master Table */}
      <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl max-w-7xl mx-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/40 text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-4">Item Details</th>
              <th className="p-4">Type</th>
              <th className="p-4">User</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-white/5">
            {adminItems.map(item => (
              <tr key={item.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Image logic stays the same */}
                    {item.image ? (
                      <img src={item.image} className="w-10 h-10 rounded bg-slate-800 object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-gray-500"><Search size={16} /></div>
                    )}

                    <div>
                      <p className="font-bold text-white">{item.name}</p>

                      {/* ✅ NEW SMART DATE LOGIC */}
                      <p className="text-xs text-gray-500">
                        {item.location} • {
                          item.dateLostFound
                            ? (
                              // ✅ FIX: Convert manual date to nice format (Slashes)
                              new Date(item.dateLostFound).toLocaleDateString() +
                              (item.timeLostFound ? ` at ${item.timeLostFound}` : '')
                            )
                            // Fallback to System Date (Slashes)
                            : new Date(item.createdAt?.seconds * 1000).toLocaleDateString()
                        }
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${item.type === 'lost'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                    {item.type}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-gray-300">
                    <User size={16} className="text-gray-500" />
                    <div>
                      {/* Show Name if available, otherwise show part of Email */}
                      <p className="font-bold text-white text-xs">
                        {item.userName || item.userEmail.split('@')[0]}
                      </p>
                      <p className="text-[10px] text-gray-500">{item.userEmail}</p>
                      {/* Show Phone only if it exists */}
                      {item.userPhone && item.userPhone !== "No Phone" && (
                        <p className="text-[10px] font-mono text-blue-400">{item.userPhone}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  {/* CASE 1: RETURNED */}
                  {item.status === 'returned' && (
                    <span className="text-green-400 flex items-center gap-1 text-xs font-bold">
                      <CheckCircle size={14} /> RESOLVED
                    </span>
                  )}

                  {/* CASE 2: CLAIM PENDING (Show Claimant Details!) */}
                  {item.status === 'claimed_pending' && (
                    <div>
                      <span className="text-orange-400 flex items-center gap-1 text-xs font-bold mb-1">
                        <Shield size={14} /> CLAIM PENDING
                      </span>
                      <div className="text-[10px] text-gray-400 bg-white/5 p-1.5 rounded border border-white/10">
                        <p className="text-orange-200 font-semibold">{item.claimantName || "Unknown"}</p>
                        <p className="font-mono">{item.claimantPhone}</p>
                      </div>
                    </div>
                  )}

                  {/* CASE 3: ACTIVE (Open) */}
                  {item.status === 'open' && (
                    <span className="text-blue-400 flex items-center gap-1 text-xs font-bold">
                      <Search size={14} /> ACTIVE
                    </span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleAdminDelete(item.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Spam"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- LOADING SCREEN ---
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
        <p className="text-gray-400 animate-pulse">Verifying Credentials...</p>
      </div>
    );
  }

  // --- RENDER CONTROL ---

  // SAFETY GUARD: Allow 'admin' to pass even if user is null
  if (!user && activeView !== 'signup' && activeView !== 'login' && activeView !== 'admin') {
    return renderLogin();
  }

  if (activeView === 'login') return renderLogin();
  if (activeView === 'signup') return renderSignup();
  if (activeView === 'admin') return renderAdmin();

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20">
      <nav className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl flex items-center gap-2" onClick={() => setActiveView('home')}>
            <Search className="text-purple-500" /> {CONFIG.appName}
          </div>
          <div className="flex gap-4 items-center">

            {/* HOME BUTTON (Matches Logout style) */}
            <Button
              variant="secondary"
              className="py-1 px-4 text-sm"
              onClick={() => setActiveView('home')}
            >
              <Home size={14} /> Home
            </Button>

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

            {/* PROFILE LINK */}
            <button
              onClick={() => setActiveView('profile')}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-white/10"
              title="Edit Profile"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                {name ? name.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="hidden md:block max-w-[100px] truncate font-medium">
                {name || user?.email?.split('@')[0]}
              </span>
            </button>
          </div>
        </div>
      </nav>
      <main className="px-4">
        {activeView === 'home' && renderHome()}
        {activeView === 'reportLost' && renderForm('lost')}
        {activeView === 'reportFound' && renderForm('found')}
        {activeView === 'matches' && renderMatches()}
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'profile' && renderProfile()}
      </main>
      {/* ✅ This line here make the modal sits on top of everything */}
      {renderDetailModal()}
    </div>
  );
}