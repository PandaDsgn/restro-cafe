import React, { useState, useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthContext";
import Auth from "./Auth";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import emailjs from "@emailjs/browser";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App = () => {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-[#FBFBF9] text-stone-900 font-sans selection:bg-[#D4AF37] selection:text-white flex flex-col">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#1c1917",
              color: "#fff",
              fontSize: "14px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            },
          }}
        />
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/reservation" element={<Reservation />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </HashRouter>
  );
};

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Successfully logged out.");
      navigate("/");
    } catch (error) {
      console.error("Failed to log out", error);
      toast.error("Failed to log out.");
    }
  };

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? "bg-white/90 backdrop-blur-md py-4 border-b border-stone-200 shadow-sm" : "bg-transparent py-8"}`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
        <Link
          to="/"
          className="text-2xl md:text-3xl font-serif tracking-[0.2em] text-stone-900 uppercase"
        >
          The Restro-Cafe
        </Link>
        <div className="space-x-8 lg:space-x-12 text-xs uppercase tracking-[0.2em] font-medium hidden md:block">
          <Link
            to="/"
            className="text-stone-800 hover:text-gold transition-colors duration-300"
          >
            Experience
          </Link>
          <Link
            to="/menu"
            className="text-stone-800 hover:text-gold transition-colors duration-300"
          >
            Dining
          </Link>
          <Link
            to="/reservation"
            className="text-stone-800 hover:text-gold transition-colors duration-300"
          >
            Reservations
          </Link>
          <Link
            to="/contact"
            className="text-stone-800 hover:text-gold transition-colors duration-300"
          >
            Contact
          </Link>
          {currentUser ? (
            <span className="space-x-8">
              <Link
                to="/dashboard"
                className="text-stone-800 hover:text-gold transition-colors duration-300 border-b border-transparent hover:border-gold pb-1"
              >
                My Booking
              </Link>
              <button
                onClick={handleLogout}
                className="text-stone-800 hover:text-gold transition-colors duration-300 uppercase tracking-[0.2em]"
              >
                Logout
              </button>
            </span>
          ) : (
            <Link
              to="/auth"
              className="text-stone-800 hover:text-gold transition-colors duration-300"
            >
              Member Access
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

const SmallGoldDivider = () => (
  <div className="flex items-center space-x-3 my-8">
    <div className="h-[1px] w-12 bg-[#D4AF37] opacity-60"></div>
    <div className="w-2 h-2 rotate-45 border border-[#D4AF37] opacity-80"></div>
    <div className="h-[1px] w-12 bg-[#D4AF37] opacity-60"></div>
  </div>
);

const Reservation = () => {
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [selectedMinute, setSelectedMinute] = useState("");
  const [selectedAmPm, setSelectedAmPm] = useState("");
  const [guests, setGuests] = useState(2);
  const [isBooking, setIsBooking] = useState(false);

  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [hourDropdownOpen, setHourDropdownOpen] = useState(false);
  const [minuteDropdownOpen, setMinuteDropdownOpen] = useState(false);
  const [amPmDropdownOpen, setAmPmDropdownOpen] = useState(false);

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();

  const years = [
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
    currentYear + 4,
    currentYear + 5,
    currentYear + 6,
    currentYear + 7,
    currentYear + 8,
    currentYear + 9,
    currentYear + 10,
  ];

  const months = [
    { value: 0, label: "January" },
    { value: 1, label: "February" },
    { value: 2, label: "March" },
    { value: 3, label: "April" },
    { value: 4, label: "May" },
    { value: 5, label: "June" },
    { value: 6, label: "July" },
    { value: 7, label: "August" },
    { value: 8, label: "September" },
    { value: 9, label: "October" },
    { value: 10, label: "November" },
    { value: 11, label: "December" },
  ];

  useEffect(() => {
    const closeAllMenus = () => {
      setDayDropdownOpen(false);
      setMonthDropdownOpen(false);
      setYearDropdownOpen(false);
      setHourDropdownOpen(false);
      setMinuteDropdownOpen(false);
      setAmPmDropdownOpen(false);
    };
    document.addEventListener("click", closeAllMenus);
    return () => document.removeEventListener("click", closeAllMenus);
  }, []);

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getAvailableDays = () => {
    if (selectedMonth === "" || !selectedYear) return [];

    const numMonth = parseInt(selectedMonth);
    const numYear = parseInt(selectedYear);
    const totalDays = getDaysInMonth(numMonth, numYear);
    const dayArray = [];

    for (let d = 1; d <= totalDays; d++) {
      if (
        numYear === currentYear &&
        numMonth === currentMonth &&
        d < currentDate
      ) {
        continue;
      }
      dayArray.push(d);
    }
    return dayArray;
  };

  const getAvailableMonths = () => {
    if (!selectedYear) return [];
    const numYear = parseInt(selectedYear);

    if (numYear === currentYear) {
      return months.filter((m) => m.value >= currentMonth);
    }
    return months;
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minutesList = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0"),
  );
  const amPmOptions = ["AM", "PM"];

  const getConstructedDate = () => {
    if (selectedDay === "" || selectedMonth === "" || !selectedYear)
      return null;
    const constructed = new Date(
      parseInt(selectedYear),
      parseInt(selectedMonth),
      parseInt(selectedDay),
    );
    constructed.setHours(0, 0, 0, 0);
    return constructed;
  };

  const isTimeSlotDisabled = (hour, minute, amPm, date) => {
    if (!date || !hour || !minute || !amPm) return false;

    let numHour = parseInt(hour);
    const mins = parseInt(minute);

    if (amPm === "AM" && numHour >= 1 && numHour <= 6) {
      return true;
    }

    if (amPm === "PM" && numHour !== 12) numHour += 12;
    if (amPm === "AM" && numHour === 12) numHour = 0;

    const targetDateTime = new Date(date);
    targetDateTime.setHours(numHour, mins, 0, 0);

    const now = new Date();
    const minAdvanceWindowMs = 12 * 60 * 60 * 1000;

    return targetDateTime.getTime() - now.getTime() < minAdvanceWindowMs;
  };

  useEffect(() => {
    const numYear = selectedYear ? parseInt(selectedYear) : null;
    const numMonth = selectedMonth !== "" ? parseInt(selectedMonth) : null;
    const numDay = selectedDay !== "" ? parseInt(selectedDay) : null;

    if (numYear !== null && numMonth !== null) {
      if (numYear === currentYear && numMonth < currentMonth) {
        setSelectedMonth("");
        setSelectedDay("");
        setSelectedHour("");
        setSelectedMinute("");
        setSelectedAmPm("");
        return;
      }
    }

    if (numYear !== null && numMonth !== null && numDay !== null) {
      const maxDays = getDaysInMonth(numMonth, numYear);
      const isPastDay =
        numYear === currentYear &&
        numMonth === currentMonth &&
        numDay < currentDate;

      if (numDay > maxDays || isPastDay) {
        setSelectedDay("");
        setSelectedHour("");
        setSelectedMinute("");
        setSelectedAmPm("");
        return;
      }
    }

    if (selectedHour && selectedMinute && selectedAmPm) {
      const constructedDate = getConstructedDate();
      if (constructedDate) {
        const disabled = isTimeSlotDisabled(
          selectedHour,
          selectedMinute,
          selectedAmPm,
          constructedDate,
        );
        if (disabled) {
          setSelectedHour("");
          setSelectedMinute("");
          setSelectedAmPm("");
        }
      }
    }
  }, [
    selectedYear,
    selectedMonth,
    selectedDay,
    selectedHour,
    selectedMinute,
    selectedAmPm,
  ]);

  const handleReservationSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      toast.error("Please log in to secure your reservation.");
      navigate("/auth");
      return;
    }

    const targetDate = getConstructedDate();
    if (!targetDate || !selectedHour || !selectedMinute || !selectedAmPm) {
      toast.error("Please select a complete date and time.");
      return;
    }

    if (
      isTimeSlotDisabled(selectedHour, selectedMinute, selectedAmPm, targetDate)
    ) {
      toast.error("The selected time slot is currently unavailable.");
      return;
    }

    const yearStr = selectedYear;
    const monthStr = String(parseInt(selectedMonth) + 1).padStart(2, "0");
    const dayStr = String(selectedDay).padStart(2, "0");
    const formattedDate = `${yearStr}-${monthStr}-${dayStr}`;

    let numHour = parseInt(selectedHour);
    const mins = parseInt(selectedMinute);
    if (selectedAmPm === "PM" && numHour !== 12) numHour += 12;
    if (selectedAmPm === "AM" && numHour === 12) numHour = 0;
    const formattedTime = `${String(numHour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

    setIsBooking(true);

    try {
      const userQuery = query(
        collection(db, "reservations"),
        where("userId", "==", currentUser.uid),
      );
      const existingRes = await getDocs(userQuery);

      if (!existingRes.empty) {
        toast.error(
          "You already have an active reservation. Limit is one per member.",
        );
        setIsBooking(false);
        return;
      }

      const timeQuery = query(
        collection(db, "reservations"),
        where("date", "==", formattedDate),
        where("time", "==", formattedTime),
      );
      const takenDocs = await getDocs(timeQuery);
      const takenTableIds = takenDocs.docs.map((doc) => doc.data().tableId);

      const allTables = [
        { id: "S01", cap: 1 },
        { id: "S02", cap: 1 },
        { id: "S03", cap: 1 },
        { id: "S04", cap: 1 },
        { id: "S05", cap: 1 },
        { id: "S06", cap: 1 },
        { id: "S07", cap: 1 },
        { id: "S08", cap: 1 },
        { id: "S09", cap: 1 },
        { id: "S11", cap: 1 },
        { id: "S12", cap: 1 },
        { id: "S13", cap: 2 },
        { id: "S14", cap: 2 },
        { id: "S15", cap: 2 },
        { id: "S16", cap: 2 },
        { id: "S17", cap: 2 },
        { id: "S18", cap: 2 },
        { id: "S19", cap: 2 },
        { id: "S21", cap: 2 },
        { id: "S22", cap: 2 },
        { id: "S23", cap: 2 },
        { id: "S24", cap: 2 },
        { id: "S25", cap: 3 },
        { id: "S26", cap: 3 },
        { id: "S27", cap: 3 },
        { id: "S28", cap: 3 },
        { id: "S29", cap: 3 },
        { id: "S31", cap: 3 },
        { id: "S32", cap: 3 },
        { id: "S33", cap: 3 },
        { id: "S34", cap: 3 },
        { id: "S35", cap: 3 },
        { id: "S36", cap: 3 },
        { id: "S37", cap: 4 },
        { id: "S38", cap: 4 },
        { id: "S39", cap: 4 },
        { id: "S41", cap: 4 },
        { id: "S42", cap: 4 },
        { id: "S43", cap: 4 },
        { id: "S44", cap: 4 },
        { id: "S45", cap: 4 },
        { id: "S46", cap: 4 },
        { id: "S47", cap: 4 },
        { id: "S48", cap: 4 },
        { id: "S49", cap: 4 },
        { id: "S10", cap: 5 },
        { id: "S20", cap: 5 },
        { id: "S30", cap: 5 },
        { id: "S40", cap: 10, area: "Grand Enclosure" },
        { id: "S50", cap: 10, area: "Grand Enclosure" },
      ];

      const availableTables = allTables.filter(
        (t) => !takenTableIds.includes(t.id),
      );
      let assignedTable = null;

      if (guests > 5) {
        assignedTable = availableTables.find((t) => t.cap === 10);
      } else {
        const validTables = availableTables
          .filter((t) => t.cap >= guests && t.cap <= 5)
          .sort((a, b) => a.cap - b.cap);
        if (validTables.length > 0) assignedTable = validTables[0];
      }

      if (!assignedTable) {
        toast.error("No tables available for that party size at this time.");
        setIsBooking(false);
        return;
      }

      await addDoc(collection(db, "reservations"), {
        userId: currentUser.uid,
        email: currentUser.email || "No email",
        date: formattedDate,
        time: formattedTime,
        guests: guests,
        tableId: assignedTable.id,
        area: assignedTable.area || "Main Dining Room",
        status: "Confirmed",
        createdAt: serverTimestamp(),
      });

      try {
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_ACTIVE_TEMPLATE_ID,
          {
            to_email: currentUser.email,
            name: currentUser.displayName || "Guest",
            status: "Confirmed",
            action: "secured",
            date: formattedDate,
            time: formattedTime,
            guests: guests,
            table_id: assignedTable.id,
            area: assignedTable.area || "Main Dining Room",
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
        );
      } catch (emailError) {
        console.error("Email failed to send:", emailError);
      }

      toast.success(
        `Confirmed! Table ${assignedTable.id} secured for ${formattedDate}.`,
      );
      navigate("/dashboard");
    } catch (error) {
      console.error("DATABASE ERROR:", error);
      toast.error("Failed to secure table. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  const getMonthLabel = (val) => {
    const match = months.find((m) => m.value === parseInt(val));
    return match ? match.label : "MONTH";
  };

  return (
    <div className="animate-fade-in pt-40 pb-24 bg-[#FBFBF9] min-h-screen flex items-center justify-center">
      <div className="max-w-6xl mx-auto px-6 w-full flex flex-col lg:flex-row shadow-2xl overflow-hidden bg-white">
        <div className="lg:w-2/5 relative min-h-[300px] lg:min-h-auto">
          <img
            src="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=1974&auto=format&fit=crop"
            alt="Dining Table"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-stone-900/40"></div>
          <div className="absolute bottom-10 left-10 text-white">
            <h3 className="font-serif text-3xl tracking-[0.2em] uppercase mb-2">
              Secure
            </h3>
            <h3 className="font-serif text-3xl tracking-[0.2em] uppercase text-[#D4AF37]">
              Your Table
            </h3>
          </div>
        </div>

        <div className="lg:w-3/5 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
          <h4 className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] mb-10 font-semibold border-b border-stone-100 pb-4">
            Bespoke Table Allocation
          </h4>

          <form onSubmit={handleReservationSubmit} className="space-y-10">
            <div className="flex flex-col">
              <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-4 font-semibold">
                Party Size
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGuests(num)}
                    className={`py-3 text-xs uppercase tracking-wider transition-all duration-300 font-medium border ${
                      guests === num
                        ? "bg-stone-900 border-stone-900 text-white"
                        : "border-stone-200 text-stone-800 hover:border-stone-900"
                    }`}
                  >
                    {num === 10 ? "6-10" : num} {num === 1 ? "Guest" : "Guests"}
                  </button>
                ))}
              </div>
              {guests === 10 && (
                <p className="text-[10px] text-[#D4AF37] mt-2 tracking-widest uppercase">
                  Assigned to the luxury Grand Enclosure
                </p>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-4 font-semibold">
                Select Date
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={selectedMonth === "" || !selectedYear}
                    onClick={() => {
                      setDayDropdownOpen(!dayDropdownOpen);
                      setMonthDropdownOpen(false);
                      setYearDropdownOpen(false);
                      setHourDropdownOpen(false);
                      setMinuteDropdownOpen(false);
                      setAmPmDropdownOpen(false);
                    }}
                    className="w-full py-3.5 px-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs uppercase tracking-widest font-semibold flex justify-between items-center transition-all duration-300 hover:border-stone-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>
                      {selectedDay !== "" ? `Day ${selectedDay}` : "DAY"}
                    </span>
                    <span className="text-[9px] text-[#D4AF37]">▼</span>
                  </button>

                  {dayDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-stone-900 text-white border border-stone-800 z-50 shadow-xl">
                      {getAvailableDays().map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setSelectedDay(d);
                            setDayDropdownOpen(false);
                          }}
                          className="w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors hover:bg-[#D4AF37] font-semibold border-b border-stone-800"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={!selectedYear}
                    onClick={() => {
                      setMonthDropdownOpen(!monthDropdownOpen);
                      setDayDropdownOpen(false);
                      setYearDropdownOpen(false);
                      setHourDropdownOpen(false);
                      setMinuteDropdownOpen(false);
                      setAmPmDropdownOpen(false);
                    }}
                    className="w-full py-3.5 px-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs uppercase tracking-widest font-semibold flex justify-between items-center transition-all duration-300 hover:border-stone-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>
                      {selectedMonth !== ""
                        ? getMonthLabel(selectedMonth)
                        : "MONTH"}
                    </span>
                    <span className="text-[9px] text-[#D4AF37]">▼</span>
                  </button>

                  {monthDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-stone-900 text-white border border-stone-800 z-50 shadow-xl">
                      {getAvailableMonths().map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setSelectedMonth(String(m.value));
                            setMonthDropdownOpen(false);
                          }}
                          className="w-full py-2.5 px-4 text-left text-xs uppercase tracking-wider transition-colors hover:bg-[#D4AF37] font-semibold border-b border-stone-800"
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setYearDropdownOpen(!yearDropdownOpen);
                      setDayDropdownOpen(false);
                      setMonthDropdownOpen(false);
                      setHourDropdownOpen(false);
                      setMinuteDropdownOpen(false);
                      setAmPmDropdownOpen(false);
                    }}
                    className="w-full py-3.5 px-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs uppercase tracking-widest font-semibold flex justify-between items-center transition-all duration-300 hover:border-stone-900"
                  >
                    <span>{selectedYear || "YEAR"}</span>
                    <span className="text-[9px] text-[#D4AF37]">▼</span>
                  </button>

                  {yearDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-stone-900 text-white border border-stone-800 z-50 shadow-xl">
                      {years.map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => {
                            setSelectedYear(String(y));
                            setYearDropdownOpen(false);
                          }}
                          className="w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors hover:bg-[#D4AF37] font-semibold border-b border-stone-800"
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-4 font-semibold">
                Select Time
              </label>
              {selectedDay === "" || selectedMonth === "" || !selectedYear ? (
                <p className="text-xs text-stone-400 italic tracking-wide">
                  Please specify a valid calendar date first.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setHourDropdownOpen(!hourDropdownOpen);
                        setDayDropdownOpen(false);
                        setMonthDropdownOpen(false);
                        setYearDropdownOpen(false);
                        setMinuteDropdownOpen(false);
                        setAmPmDropdownOpen(false);
                      }}
                      className="w-full py-3.5 px-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs uppercase tracking-widest font-semibold flex justify-between items-center transition-all duration-300 hover:border-stone-900"
                    >
                      <span>
                        {selectedHour !== "" ? `${selectedHour} h` : "HOUR"}
                      </span>
                      <span className="text-[9px] text-[#D4AF37]">▼</span>
                    </button>

                    {hourDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-[160px] overflow-y-auto bg-stone-900 text-white border border-stone-800 z-50 shadow-xl">
                        {hoursList.map((h) => {
                          const disabled = isTimeSlotDisabled(
                            h,
                            selectedMinute || "00",
                            selectedAmPm || "PM",
                            getConstructedDate(),
                          );
                          return (
                            <button
                              key={h}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setSelectedHour(h);
                                setHourDropdownOpen(false);
                              }}
                              className={`w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors font-semibold border-b border-stone-800 ${
                                disabled
                                  ? "text-stone-600 cursor-not-allowed bg-stone-950/40"
                                  : "hover:bg-[#D4AF37]"
                              }`}
                            >
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMinuteDropdownOpen(!minuteDropdownOpen);
                        setDayDropdownOpen(false);
                        setMonthDropdownOpen(false);
                        setYearDropdownOpen(false);
                        setHourDropdownOpen(false);
                        setAmPmDropdownOpen(false);
                      }}
                      className="w-full py-3.5 px-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs uppercase tracking-widest font-semibold flex justify-between items-center transition-all duration-300 hover:border-stone-900"
                    >
                      <span>
                        {selectedMinute !== ""
                          ? `${selectedMinute} m`
                          : "MINUTE"}
                      </span>
                      <span className="text-[9px] text-[#D4AF37]">▼</span>
                    </button>

                    {minuteDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-[200px] overflow-y-auto bg-stone-900 text-white border border-stone-800 z-50 shadow-xl">
                        {minutesList.map((m) => {
                          const disabled = isTimeSlotDisabled(
                            selectedHour || "12",
                            m,
                            selectedAmPm || "PM",
                            getConstructedDate(),
                          );
                          return (
                            <button
                              key={m}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setSelectedMinute(m);
                                setMinuteDropdownOpen(false);
                              }}
                              className={`w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors font-semibold border-b border-stone-800 ${
                                disabled
                                  ? "text-stone-600 cursor-not-allowed bg-stone-950/40"
                                  : "hover:bg-[#D4AF37]"
                              }`}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAmPmDropdownOpen(!amPmDropdownOpen);
                        setDayDropdownOpen(false);
                        setMonthDropdownOpen(false);
                        setYearDropdownOpen(false);
                        setHourDropdownOpen(false);
                        setMinuteDropdownOpen(false);
                      }}
                      className="w-full py-3.5 px-4 bg-stone-50 border border-stone-200 text-stone-800 text-xs uppercase tracking-widest font-semibold flex justify-between items-center transition-all duration-300 hover:border-stone-900"
                    >
                      <span>{selectedAmPm || "AM / PM"}</span>
                      <span className="text-[9px] text-[#D4AF37]">▼</span>
                    </button>

                    {amPmDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 bg-stone-900 text-white border border-stone-800 z-50 shadow-xl">
                        {amPmOptions.map((p) => {
                          const disabled = isTimeSlotDisabled(
                            selectedHour || "12",
                            selectedMinute || "00",
                            p,
                            getConstructedDate(),
                          );
                          return (
                            <button
                              key={p}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setSelectedAmPm(p);
                                setAmPmDropdownOpen(false);
                              }}
                              className={`w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors font-semibold border-b border-stone-800 ${
                                disabled
                                  ? "text-stone-600 cursor-not-allowed bg-stone-950/40"
                                  : "hover:bg-[#D4AF37]"
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={
                isBooking ||
                selectedDay === "" ||
                selectedMonth === "" ||
                !selectedYear ||
                !selectedHour ||
                !selectedMinute ||
                !selectedAmPm
              }
              className="w-full bg-stone-900 text-white px-12 py-5 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] transition-all duration-500 font-medium mt-4 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isBooking ? "Confirming..." : "Request Booking"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editGuests, setEditGuests] = useState("2");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate("/auth");
      return;
    }

    const fetchReservation = async () => {
      try {
        const q = query(
          collection(db, "reservations"),
          where("userId", "==", currentUser.uid),
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0];
          setReservation({ id: docData.id, ...docData.data() });
          setEditDate(docData.data().date);
          setEditTime(docData.data().time);
          setEditGuests(docData.data().guests.toString());
        }
      } catch (error) {
        console.error("Error fetching reservation:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReservation();
  }, [currentUser, navigate]);

  const canModify = () => {
    if (!reservation) return false;
    const resDate = new Date(`${reservation.date}T${reservation.time}`);
    const now = new Date();
    const diffInHours = (resDate - now) / (1000 * 60 * 60);
    return diffInHours >= 24;
  };

  const handleCancel = async () => {
    if (!canModify()) {
      toast.error("Reservations cannot be modified within 24 hours.");
      return;
    }

    if (
      window.confirm(
        "Are you sure you want to cancel this majestic dining experience?",
      )
    ) {
      try {
        await deleteDoc(doc(db, "reservations", reservation.id));

        try {
          await emailjs.send(
            import.meta.env.VITE_EMAILJS_SERVICE_ID,
            import.meta.env.VITE_EMAILJS_CANCEL_TEMPLATE_ID,
            {
              to_email: currentUser.email,
              name: currentUser.displayName || "Guest",
              date: reservation.date,
              time: reservation.time,
            },
            import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
          );
        } catch (emailError) {
          console.error("Cancellation email failed to send:", emailError);
        }

        toast.success("Reservation cancelled successfully.");
        setReservation(null);
      } catch (error) {
        toast.error("Failed to cancel. Please try again.");
      }
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!canModify()) {
      toast.error("Reservations cannot be modified within 24 hours.");
      return;
    }

    setIsProcessing(true);
    try {
      const requestedSeats = parseInt(editGuests);

      const timeQuery = query(
        collection(db, "reservations"),
        where("date", "==", editDate),
        where("time", "==", editTime),
      );
      const takenDocs = await getDocs(timeQuery);
      const takenTableIds = takenDocs.docs
        .filter((d) => d.id !== reservation.id)
        .map((doc) => doc.data().tableId);

      const allTables = [
        { id: "S01", cap: 1 },
        { id: "S02", cap: 1 },
        { id: "S03", cap: 1 },
        { id: "S04", cap: 1 },
        { id: "S05", cap: 1 },
        { id: "S06", cap: 1 },
        { id: "S07", cap: 1 },
        { id: "S08", cap: 1 },
        { id: "S09", cap: 1 },
        { id: "S11", cap: 1 },
        { id: "S12", cap: 1 },
        { id: "S13", cap: 2 },
        { id: "S14", cap: 2 },
        { id: "S15", cap: 2 },
        { id: "S16", cap: 2 },
        { id: "S17", cap: 2 },
        { id: "S18", cap: 2 },
        { id: "S19", cap: 2 },
        { id: "S21", cap: 2 },
        { id: "S22", cap: 2 },
        { id: "S23", cap: 2 },
        { id: "S24", cap: 2 },
        { id: "S25", cap: 3 },
        { id: "S26", cap: 3 },
        { id: "S27", cap: 3 },
        { id: "S28", cap: 3 },
        { id: "S29", cap: 3 },
        { id: "S31", cap: 3 },
        { id: "S32", cap: 3 },
        { id: "S33", cap: 3 },
        { id: "S34", cap: 3 },
        { id: "S35", cap: 3 },
        { id: "S36", cap: 3 },
        { id: "S37", cap: 4 },
        { id: "S38", cap: 4 },
        { id: "S39", cap: 4 },
        { id: "S41", cap: 4 },
        { id: "S42", cap: 4 },
        { id: "S43", cap: 4 },
        { id: "S44", cap: 4 },
        { id: "S45", cap: 4 },
        { id: "S46", cap: 4 },
        { id: "S47", cap: 4 },
        { id: "S48", cap: 4 },
        { id: "S49", cap: 4 },
        { id: "S10", cap: 5 },
        { id: "S20", cap: 5 },
        { id: "S30", cap: 5 },
        { id: "S40", cap: 10, area: "Grand Enclosure" },
        { id: "S50", cap: 10, area: "Grand Enclosure" },
      ];

      const availableTables = allTables.filter(
        (t) => !takenTableIds.includes(t.id),
      );
      let assignedTable = null;

      if (requestedSeats > 5) {
        assignedTable = availableTables.find((t) => t.cap === 10);
      } else {
        const validTables = availableTables
          .filter((t) => t.cap >= requestedSeats && t.cap <= 5)
          .sort((a, b) => a.cap - b.cap);
        if (validTables.length > 0) assignedTable = validTables[0];
      }

      if (!assignedTable) {
        toast.error(
          "No tables available for that size/time. Try another slot.",
        );
        setIsProcessing(false);
        return;
      }

      const updatedData = {
        date: editDate,
        time: editTime,
        guests: requestedSeats,
        tableId: assignedTable.id,
        area: assignedTable.area || "Main Dining Room",
      };

      await updateDoc(doc(db, "reservations", reservation.id), updatedData);

      try {
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_ACTIVE_TEMPLATE_ID,
          {
            to_email: currentUser.email,
            name: currentUser.displayName || "Guest",
            status: "Updated",
            action: "updated",
            date: editDate,
            time: editTime,
            guests: requestedSeats,
            table_id: assignedTable.id,
            area: assignedTable.area || "Main Dining Room",
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
        );
      } catch (emailError) {
        console.error("Update email failed to send:", emailError);
      }

      setReservation({ ...reservation, ...updatedData });
      setIsEditing(false);
      toast.success(`Booking updated. New table: ${assignedTable.id}`);
    } catch (error) {
      toast.error("Failed to update booking.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="pt-40 text-center min-h-screen">
        Loading your itinerary...
      </div>
    );

  return (
    <div className="animate-fade-in pt-40 pb-24 bg-[#FBFBF9] min-h-screen">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif tracking-widest uppercase text-stone-900 mb-6">
            Member Dashboard
          </h2>
          <p className="text-stone-500 font-medium tracking-widest text-sm uppercase">
            Welcome, {currentUser?.displayName || currentUser?.email}
          </p>
        </div>

        {!reservation ? (
          <div className="bg-white border border-stone-200 p-12 text-center shadow-sm">
            <h3 className="text-2xl font-serif text-stone-900 mb-4">
              No Active Reservations
            </h3>
            <p className="text-stone-500 mb-8 tracking-wide">
              You currently do not have any upcoming dining experiences
              scheduled with us.
            </p>
            <Link
              to="/reservation"
              className="bg-stone-900 text-white px-10 py-4 uppercase tracking-[0.2em] text-xs hover:bg-gold transition-colors font-medium"
            >
              Secure a Table
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 p-8 md:p-12 shadow-sm relative">
            <div className="absolute top-0 right-0 bg-[#D4AF37] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 m-6">
              {reservation.status}
            </div>

            <h3 className="text-2xl font-serif text-stone-900 mb-8 border-b border-stone-100 pb-4">
              Your Itinerary
            </h3>

            {!isEditing ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-2">
                    Date
                  </p>
                  <p className="font-serif text-lg text-stone-900">
                    {reservation.date}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-2">
                    Time
                  </p>
                  <p className="font-serif text-lg text-stone-900">
                    {reservation.time}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-2">
                    Party Size
                  </p>
                  <p className="font-serif text-lg text-stone-900">
                    {reservation.guests} Guests
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-2">
                    Allocation
                  </p>
                  <p className="font-serif text-lg text-stone-900">
                    Table {reservation.tableId}
                  </p>
                  <p className="text-xs text-gold mt-1">{reservation.area}</p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleUpdate}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 bg-stone-50 p-6 border border-stone-100"
              >
                <div className="flex flex-col">
                  <label className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-2">
                    Guests
                  </label>
                  <select
                    value={editGuests}
                    onChange={(e) => setEditGuests(e.target.value)}
                    className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold appearance-none"
                  >
                    <option value="1">1 Person</option>
                    <option value="2">2 People</option>
                    <option value="3">3 People</option>
                    <option value="4">4 People</option>
                    <option value="5">5 People</option>
                    <option value="10">6-10 People (Grand Enclosure)</option>
                  </select>
                </div>
                <div className="col-span-1 md:col-span-3 flex justify-end space-x-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2 text-xs uppercase tracking-[0.2em] font-medium text-stone-500 hover:text-stone-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="bg-gold text-white px-8 py-2 uppercase tracking-[0.2em] text-xs font-medium hover:bg-stone-900 transition-colors"
                  >
                    {isProcessing ? "Checking..." : "Confirm Changes"}
                  </button>
                </div>
              </form>
            )}

            {!canModify() && !isEditing && (
              <div className="bg-orange-50 border border-orange-100 p-4 mb-8">
                <p className="text-xs text-orange-800 uppercase tracking-widest text-center">
                  Notice: Modifications are disabled within 24 hours of your
                  booking time. Please contact the concierge directly.
                </p>
              </div>
            )}

            {!isEditing && canModify() && (
              <div className="flex justify-end space-x-6 border-t border-stone-100 pt-6">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs uppercase tracking-[0.2em] text-stone-500 hover:text-gold font-medium transition-colors"
                >
                  Modify Booking
                </button>
                <button
                  onClick={handleCancel}
                  className="text-xs uppercase tracking-[0.2em] text-red-400 hover:text-red-600 font-medium transition-colors"
                >
                  Cancel Reservation
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease: [0.2, 0.65, 0.3, 0.9] },
    },
  };

  const pointers = [
    {
      title: "SUSTAINABILITY",
      text: "This LEED Platinum certified hotel, ensures that the promise of luxury is upheld while the planet is protected with sensitivity. The hotel operations are conducted in a manner to have a positive impact on the planet and the community while delivering authentic indigenous experiences.",
      image:
        "https://images.unsplash.com/photo-1466637574441-749b8f19452f?q=80&w=2000&auto=format&fit=crop",
    },
    {
      title: "ARTISANAL SOURCING",
      text: "We partner exclusively with local purveyors and sustainable farms. Every ingredient that enters our kitchen is hand-selected with rigorous standards, ensuring unmatched freshness, quality, and a deep respect for the natural harvest.",
      image:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2000&auto=format&fit=crop",
    },
    {
      title: "CULINARY HERITAGE",
      text: "Rooted in the royal kitchens of the past, our techniques pay homage to centuries of gastronomic evolution. We meticulously preserve authentic cooking methods over slow charcoal fires, presenting them to you with contemporary finesse.",
      image:
        "https://images.unsplash.com/photo-1585937421612-70a008356fbe?q=80&w=2000&auto=format&fit=crop",
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % pointers.length);
    }, 6000);
    return () => clearTimeout(timer);
  }, [currentSlide, pointers.length]);

  return (
    <div className="animate-fade-in">
      <header className="relative min-h-screen flex flex-col items-center justify-start text-center px-4 pt-32 md:pt-40 overflow-hidden bg-[#FBFBF9]">
        <div
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542314831-c6a4d14d8c53?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.15]"
          style={{ backgroundAttachment: "fixed" }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#FBFBF9]/50 to-[#FBFBF9]"></div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.3 } } }}
          className="relative z-10 w-full max-w-6xl mx-auto flex flex-col items-center"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-center space-x-4 mb-6"
          >
            <div className="w-12 h-px bg-[#D4AF37]"></div>
            <span className="text-xs md:text-sm tracking-[0.3em] uppercase text-[#D4AF37] font-medium">
              A Culinary Heritage
            </span>
            <div className="w-12 h-px bg-[#D4AF37]"></div>
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="text-5xl md:text-8xl font-serif tracking-widest text-stone-900 mb-6 leading-tight mt-4"
          >
            UNSURPASSED <br /> GRANDEUR
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="text-sm md:text-base tracking-[0.15em] font-medium text-stone-500 max-w-2xl mx-auto leading-relaxed mb-16"
          >
            Where majestic architecture meets legendary gastronomy. Step into an
            era of regal dining and impeccable hospitality.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="w-full h-[40vh] md:h-[55vh] relative shadow-xl overflow-hidden group"
          >
            <img
              src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop"
              alt="Luxury Dining Interior"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
            />
            <div className="absolute inset-0 border border-white/40 m-4 md:m-6 pointer-events-none"></div>
          </motion.div>
        </motion.div>
      </header>

      <section className="px-6 md:px-12 py-32 bg-[#FBFBF9] text-center relative border-b border-stone-200">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <svg
              className="w-8 h-8 mx-auto mb-8 text-[#D4AF37]"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <h3 className="text-3xl md:text-4xl font-serif text-stone-900 mb-8 leading-snug tracking-wide">
              An ode to the timeless elegance of imperial banquets, reimagined
              for the modern connoisseur.
            </h3>
            <p className="text-stone-600 font-medium leading-relaxed tracking-wider text-sm md:text-base max-w-2xl mx-auto mb-12">
              The Restro-Cafe stands as a testament to unparalleled luxury.
              Every ingredient is sourced with absolute precision, every dish
              crafted with a reverence for culinary history. Here, dining
              transcends the ordinary and becomes an event of majestic
              proportions.
            </p>
            <Link
              to="/menu"
              className="inline-block border border-gold text-gold px-10 py-4 uppercase tracking-[0.2em] text-xs hover:bg-gold hover:text-white transition-all duration-500 font-medium"
            >
              Discover the Menu
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-32 bg-white border-b border-stone-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row items-center gap-16 min-h-[500px]">
            <div className="w-full md:w-1/2 flex flex-col justify-center min-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <h3 className="text-3xl md:text-4xl font-serif tracking-[0.1em] text-stone-900 uppercase">
                    {pointers[currentSlide].title}
                  </h3>
                  <SmallGoldDivider />
                  <p className="text-stone-800 text-lg font-medium leading-[2.1] tracking-wide max-w-2xl">
                    {pointers[currentSlide].text}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="w-full md:w-1/2">
              <div className="relative border border-stone-200 p-3 bg-white shadow-lg overflow-hidden h-[400px] md:h-[500px]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentSlide}
                    src={pointers[currentSlide].image}
                    alt={pointers[currentSlide].title}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)] object-cover"
                  />
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-[#FBFBF9]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16">
            <h4 className="text-xs tracking-[0.3em] uppercase text-gold mb-4 font-medium">
              The Ambience
            </h4>
            <h3 className="text-3xl font-serif tracking-widest uppercase text-stone-900">
              Palatial Splendor
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="col-span-1 md:col-span-2 relative group overflow-hidden bg-stone-100"
            >
              <img
                src="https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=2070&auto=format&fit=crop"
                alt="Grand Chandelier"
                className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent flex items-end p-8">
                <p className="font-serif text-2xl tracking-widest uppercase text-white drop-shadow-md">
                  The Grand Pavilion
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="col-span-1 relative group overflow-hidden bg-stone-100"
            >
              <img
                src="https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=2070&auto=format&fit=crop"
                alt="Master Chef"
                className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent flex items-end p-8">
                <p className="font-serif text-xl tracking-widest uppercase text-gold drop-shadow-md">
                  Master Curators
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-32 bg-white border-t border-stone-200">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h4 className="text-xs tracking-[0.3em] uppercase text-gold mb-4 font-medium">
              Reservations
            </h4>
            <h3 className="text-3xl font-serif tracking-widest uppercase text-stone-900 mb-6">
              Secure Your Table
            </h3>
            <p className="text-stone-600 font-medium leading-relaxed tracking-wider text-sm md:text-base mb-12">
              Experience the pinnacle of culinary excellence. Reserve your table
              to ensure an unforgettable evening of grandeur and impeccable
              service.
            </p>
            <Link
              to="/reservation"
              className="inline-block bg-stone-900 text-white px-12 py-5 uppercase tracking-[0.2em] text-xs hover:bg-gold transition-all duration-500 font-medium"
            >
              Make a Reservation
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

const Menu = () => {
  const categories = [
    {
      title: "Signatures of the Royal Court",
      items: [
        {
          name: "Dal Bukhara Reserve",
          desc: "Slow-cooked over charcoal for 18 hours, finished with churned butter.",
          price: "₹ 1,850",
        },
        {
          name: "Sikandari Raan",
          desc: "Whole leg of spring lamb, marinated in robust spices and roasted to perfection.",
          price: "₹ 3,200",
        },
        {
          name: "Murgh Malai Kebab",
          desc: "Creamy, tender chicken morsels infused with green cardamom and cheese.",
          price: "₹ 1,600",
        },
      ],
    },
    {
      title: "Imperial Desserts",
      items: [
        {
          name: "Khubani Ka Meetha",
          desc: "Traditional slow-boiled apricots crowned with silver leaf and fresh cream.",
          price: "₹ 950",
        },
        {
          name: "Saffron Pistachio Kulfi",
          desc: "Rich, dense frozen dairy dessert infused with pure Kashmiri saffron.",
          price: "₹ 850",
        },
      ],
    },
  ];

  return (
    <div className="animate-fade-in pt-40 pb-24 bg-[#FBFBF9] min-h-screen">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-20">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="w-8 h-px bg-gold"></div>
            <span className="text-xs tracking-[0.3em] uppercase text-gold font-medium">
              Epicurean Mastery
            </span>
            <div className="w-8 h-px bg-gold"></div>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif tracking-widest uppercase text-stone-900 mb-6">
            The Royal Menu
          </h2>
          <p className="text-stone-500 font-medium tracking-widest text-sm">
            A curation of legendary recipes passed down through generations.
          </p>
        </div>

        {categories.map((category, idx) => (
          <div key={idx} className="mb-20">
            <h3 className="text-2xl font-serif tracking-widest text-gold text-center uppercase mb-12 border-b border-stone-200 pb-4">
              {category.title}
            </h3>
            <div className="space-y-10">
              {category.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row justify-between items-baseline group cursor-default"
                >
                  <div className="md:w-3/4 pr-4 z-10 bg-[#FBFBF9]">
                    <h4 className="text-xl font-serif tracking-wider text-stone-900 mb-2">
                      {item.name}
                    </h4>
                    <p className="text-sm font-medium text-stone-500 tracking-wide leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-4 md:mt-0 flex-shrink-0 z-10 bg-[#FBFBF9] pl-4">
                    <span className="text-lg font-serif text-gold tracking-widest">
                      {item.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState("General Reservation");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !message) {
      toast.error("Please fill out all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "inquiries"), {
        name,
        email,
        type,
        message,
        status: "New",
        createdAt: serverTimestamp(),
      });

      toast.success("Inquiry sent. Our concierge will reach out shortly.");

      setName("");
      setEmail("");
      setType("General Reservation");
      setMessage("");
    } catch (error) {
      console.error("Error sending inquiry:", error);
      toast.error("Failed to send inquiry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in pt-40 pb-24 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row gap-16">
        <div className="lg:w-1/2">
          <h2 className="text-xs tracking-[0.3em] uppercase text-gold mb-4 font-medium">
            Connect With Us
          </h2>
          <h3 className="text-4xl md:text-5xl font-serif tracking-widest uppercase text-stone-900 mb-8 leading-tight">
            Bespoke <br /> Inquiries
          </h3>
          <p className="text-stone-600 font-medium tracking-wider leading-relaxed mb-12">
            To ensure an intimate and flawless dining experience, prior
            reservations are highly recommended. For private dining enclosures
            or bespoke event curation, kindly reach out to our concierge.
          </p>
          <div className="space-y-8 font-medium tracking-widest text-sm mb-12">
            <div>
              <p className="text-gold uppercase mb-1">The Address</p>
              <p className="text-stone-800">
                1 JBS Haldane Avenue, Tangra
                <br />
                Kolkata, West Bengal 700046
              </p>
            </div>
            <div>
              <p className="text-gold uppercase mb-1">Direct Line</p>
              <p className="text-stone-800">+91 33 4446 4646</p>
            </div>
            <div>
              <p className="text-gold uppercase mb-1">Email</p>
              <p className="text-stone-800">
                reservations@therestrocafe.luxury
              </p>
            </div>
          </div>
        </div>

        <div className="lg:w-1/2 bg-[#FBFBF9] p-8 md:p-12 border border-stone-200">
          <h4 className="font-serif text-2xl tracking-widest text-stone-900 uppercase mb-8">
            Send a Message
          </h4>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex flex-col">
              <label className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800"
                placeholder="Enter your name"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800"
                placeholder="Enter your email"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
                Inquiry Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800 appearance-none"
              >
                <option value="General Reservation">General Reservation</option>
                <option value="Private Dining Event">
                  Private Dining Event
                </option>
                <option value="Corporate Booking">Corporate Booking</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-xs tracking-[0.2em] uppercase text-stone-500 mb-2 font-medium">
                Message
              </label>
              <textarea
                rows="4"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-gold transition-colors font-medium text-stone-800 resize-none"
                placeholder="How may we assist you?"
              ></textarea>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-stone-900 text-white px-8 py-4 uppercase tracking-[0.2em] text-xs hover:bg-gold transition-all duration-500 font-medium mt-4 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Submit Inquiry"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Footer = () => {
  return (
    <footer className="py-16 bg-white border-t border-stone-200 text-center px-6">
      <h4 className="text-2xl font-serif tracking-[0.3em] text-stone-900 uppercase mb-6">
        The Restro-Cafe
      </h4>
      <div className="flex justify-center items-center space-x-6 mb-8">
        <a
          href="#"
          className="text-stone-500 hover:text-gold transition-colors tracking-widest text-xs uppercase font-medium"
        >
          Instagram
        </a>
        <span className="text-stone-300">|</span>
        <a
          href="#"
          className="text-stone-500 hover:text-gold transition-colors tracking-widest text-xs uppercase font-medium"
        >
          Facebook
        </a>
        <span className="text-stone-300">|</span>
        <a
          href="#"
          className="text-stone-500 hover:text-gold transition-colors tracking-widest text-xs uppercase font-medium"
        >
          Concierge
        </a>
      </div>
      <p className="text-[10px] tracking-[0.2em] text-stone-400 uppercase font-medium">
        © 2026 The Restro-Cafe Luxury Collection. All Rights Reserved.
      </p>
    </footer>
  );
};

export default App;
