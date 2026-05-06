import React, { useState, useEffect, createContext, useContext } from "react";
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
  orderBy,
} from "firebase/firestore";
import emailjs from "@emailjs/browser";

const parsePrice = (priceStr) => parseInt(priceStr.replace(/[^0-9]/g, ""), 10);
const formatPrice = (num) => `₹ ${num.toLocaleString("en-IN")}`;

const CartContext = createContext();
const useCart = () => useContext(CartContext);

const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.name === item.name);
      if (existing) {
        return prev.map((i) =>
          i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        { ...item, quantity: 1, numericPrice: parsePrice(item.price) },
      ];
    });
    toast.success(`${item.name} added to order.`);
  };

  const removeFromCart = (name) => {
    setCart((prev) => prev.filter((i) => i.name !== name));
  };

  const updateQuantity = (name, amount) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.name === name) {
          const newQty = i.quantity + amount;
          return newQty > 0 ? { ...i, quantity: newQty } : i;
        }
        return i;
      }),
    );
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce(
    (total, item) => total + item.numericPrice * item.quantity,
    0,
  );
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const CartDrawer = () => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
  } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [isCheckout, setIsCheckout] = useState(false);
  const [address, setAddress] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    toast.loading("Detecting precise location...", { id: "location-toast" });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
            toast.success("Location mapped successfully!", {
              id: "location-toast",
            });
          } else {
            throw new Error("Address mapping failed");
          }
        } catch (error) {
          toast.error("Failed to translate GPS coordinates.", {
            id: "location-toast",
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === 1)
          toast.error("Access denied. Please enable location permissions.", {
            id: "location-toast",
          });
        else
          toast.error("Unable to fetch GPS signal.", { id: "location-toast" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const loadRazorpay = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("Please log in to place an order.");
      setIsCartOpen(false);
      navigate("/auth");
      return;
    }
    if (!address.trim()) {
      toast.error("Please provide a delivery address.");
      return;
    }

    setIsProcessing(true);

    try {
      const orderResponse = await fetch(
        "https://restro-cafe-background.onrender.com/api/create-order",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: cartTotal }),
        },
      );

      const orderData = await orderResponse.json();

      if (!orderData || !orderData.id) {
        throw new Error("Failed to generate Order ID");
      }

      const options = {
        key: "rzp_test_YOUR_KEY_HERE",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "The Restro-Cafe",
        description: "Luxury Dining Delivery",
        order_id: orderData.id,
        handler: async function (response) {
          // ... your existing success logic ...
        },
        prefill: {
          name: currentUser.displayName || "Guest",
          email: currentUser.email,
          contact: "9999999999", // <-- ADD THIS: Razorpay requires a contact for UPI!
          vpa: paymentMethod === "UPI" ? upiId : undefined, // <-- ADD THIS: Auto-fills their UPI ID!
        },
        theme: {
          color: "#D4AF37",
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response) {
        toast.error(`Payment Failed: ${response.error.description}`);
      });

      rzp.open();
    } catch (error) {
      toast.error(
        "Secure gateway is offline. Please ensure backend is running on port 5000.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.4 }}
            className="fixed top-0 right-0 h-full w-full md:w-[450px] bg-[#FBFBF9] z-[70] shadow-2xl flex flex-col border-l border-stone-200"
          >
            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-white">
              <h2 className="font-serif tracking-widest text-xl uppercase text-stone-900">
                {isCheckout ? "Secure Checkout" : "Your Order"}
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-stone-400 hover:text-[#D4AF37] transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-stone-200">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <svg
                    className="w-16 h-16 mb-4 text-[#D4AF37]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1"
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <p className="text-xs uppercase tracking-widest font-semibold">
                    Your cart is empty.
                  </p>
                </div>
              ) : isCheckout ? (
                <form
                  id="checkout-form"
                  onSubmit={loadRazorpay}
                  className="space-y-8 animate-fade-in"
                >
                  <div className="bg-white p-4 border border-stone-100 shadow-sm">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] mb-3 font-bold">
                      Order Summary
                    </h4>
                    {cart.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs font-medium text-stone-600 mb-2"
                      >
                        <span>
                          {item.quantity}x {item.name}
                        </span>
                        <span>
                          {formatPrice(item.numericPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-stone-100 mt-3 pt-3 flex justify-between font-serif text-lg text-stone-900">
                      <span>Total</span>
                      <span>{formatPrice(cartTotal)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex justify-between items-end mb-2">
                      <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-semibold">
                        Delivery Address
                      </label>
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isLocating}
                        className="text-[9px] text-[#D4AF37] uppercase tracking-widest font-bold flex items-center hover:text-stone-900 transition-colors disabled:opacity-50"
                      >
                        <svg
                          className="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {isLocating ? "Locating..." : "Auto-Detect"}
                      </button>
                    </div>
                    <textarea
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows="3"
                      className="bg-transparent border border-stone-300 p-3 focus:outline-none focus:border-[#D4AF37] transition-colors font-medium text-stone-800 text-xs resize-none"
                      placeholder="Enter complete address..."
                    />
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  {cart.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col bg-white p-4 border border-stone-100 shadow-sm relative"
                    >
                      <button
                        onClick={() => removeFromCart(item.name)}
                        className="absolute top-2 right-2 text-stone-300 hover:text-red-500 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                      <h4 className="font-serif text-stone-900 tracking-wider mb-1 pr-6">
                        {item.name}
                      </h4>
                      <p className="text-xs text-[#D4AF37] font-semibold mb-4">
                        {item.price}
                      </p>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center border border-stone-200">
                          <button
                            onClick={() => updateQuantity(item.name, -1)}
                            className="px-3 py-1 text-stone-500 hover:bg-stone-100 transition-colors"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.name, 1)}
                            className="px-3 py-1 text-stone-500 hover:bg-stone-100 transition-colors"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-stone-600">
                          Total:{" "}
                          {formatPrice(item.numericPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-white border-t border-stone-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                {!isCheckout && (
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-xs uppercase tracking-widest font-semibold text-stone-500">
                      Subtotal
                    </span>
                    <span className="text-xl font-serif text-stone-900">
                      {formatPrice(cartTotal)}
                    </span>
                  </div>
                )}

                {isCheckout ? (
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={isProcessing}
                    className="w-full bg-stone-900 text-white py-4 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] transition-colors font-medium flex justify-center items-center"
                  >
                    {isProcessing
                      ? "Initializing Secure Gateway..."
                      : `Pay ${formatPrice(cartTotal)}`}
                  </button>
                ) : (
                  <button
                    onClick={() => setIsCheckout(true)}
                    className="w-full bg-stone-900 text-white py-4 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] transition-colors font-medium"
                  >
                    Proceed to Checkout
                  </button>
                )}
                {isCheckout && !isProcessing && (
                  <button
                    onClick={() => setIsCheckout(false)}
                    className="w-full text-center mt-4 text-[10px] uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors"
                  >
                    ← Back to Cart
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const App = () => {
  return (
    <CartProvider>
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
          <CartDrawer />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/reservation" element={<Reservation />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/concierge" element={<Concierge />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </HashRouter>
    </CartProvider>
  );
};

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser, logout } = useAuth();
  const { cartCount, setIsCartOpen } = useCart();
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
      toast.error("Failed to log out.");
    }
  };

  return (
    <nav
      className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? "bg-white/90 backdrop-blur-md py-4 border-b border-stone-200 shadow-sm" : "bg-transparent py-8"}`}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center relative">
        <Link
          to="/"
          onClick={() => setIsOpen(false)}
          className="text-2xl md:text-3xl font-serif tracking-[0.2em] text-stone-900 uppercase z-50"
        >
          The Restro-Cafe
        </Link>

        <div className="flex items-center space-x-6">
          <div className="space-x-8 lg:space-x-12 text-xs uppercase tracking-[0.2em] font-medium hidden md:block">
            <Link
              to="/"
              className="text-stone-800 hover:text-[#D4AF37] transition-colors duration-300"
            >
              Experience
            </Link>
            <Link
              to="/menu"
              className="text-stone-800 hover:text-[#D4AF37] transition-colors duration-300"
            >
              Dining
            </Link>
            <Link
              to="/reservation"
              className="text-stone-800 hover:text-[#D4AF37] transition-colors duration-300"
            >
              Reservations
            </Link>
            <Link
              to="/contact"
              className="text-stone-800 hover:text-[#D4AF37] transition-colors duration-300"
            >
              Contact
            </Link>
            {currentUser ? (
              <span className="space-x-8">
                <Link
                  to="/dashboard"
                  className="text-stone-800 hover:text-[#D4AF37] transition-colors duration-300 border-b border-transparent hover:border-[#D4AF37] pb-1"
                >
                  My Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-stone-800 hover:text-[#D4AF37] transition-colors duration-300 uppercase tracking-[0.2em]"
                >
                  Logout
                </button>
              </span>
            ) : (
              <Link
                to="/auth"
                className="text-stone-800 hover:text-[#D4AF37] transition-colors duration-300"
              >
                Member Access
              </Link>
            )}
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative text-stone-800 hover:text-[#D4AF37] transition-colors z-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#D4AF37] text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-stone-800 focus:outline-none focus:text-[#D4AF37] z-50 ml-4"
          >
            <svg
              className="w-6 h-6 transition-transform duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="md:hidden bg-white/95 backdrop-blur-md border-b border-stone-200 overflow-hidden w-full absolute top-full left-0 shadow-lg"
            >
              <div className="flex flex-col space-y-6 px-8 py-8 text-stone-800 text-xs uppercase tracking-[0.25em] font-semibold">
                <Link
                  to="/"
                  onClick={() => setIsOpen(false)}
                  className="hover:text-[#D4AF37] transition-colors duration-300"
                >
                  Experience
                </Link>
                <Link
                  to="/menu"
                  onClick={() => setIsOpen(false)}
                  className="hover:text-[#D4AF37] transition-colors duration-300"
                >
                  Dining & Ordering
                </Link>
                <Link
                  to="/reservation"
                  onClick={() => setIsOpen(false)}
                  className="hover:text-[#D4AF37] transition-colors duration-300"
                >
                  Reservations
                </Link>
                <Link
                  to="/contact"
                  onClick={() => setIsOpen(false)}
                  className="hover:text-[#D4AF37] transition-colors duration-300"
                >
                  Contact
                </Link>
                {currentUser ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="hover:text-[#D4AF37] transition-colors duration-300"
                    >
                      My Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                      className="text-left hover:text-[#D4AF37] transition-colors duration-300 uppercase tracking-[0.25em]"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    to="/auth"
                    onClick={() => setIsOpen(false)}
                    className="hover:text-[#D4AF37] transition-colors duration-300"
                  >
                    Member Access
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

  const getDaysInMonth = (month, year) =>
    new Date(year, month + 1, 0).getDate();

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
      )
        continue;
      dayArray.push(d);
    }
    return dayArray;
  };

  const getAvailableMonths = () => {
    if (!selectedYear) return [];
    const numYear = parseInt(selectedYear);
    if (numYear === currentYear)
      return months.filter((m) => m.value >= currentMonth);
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

    if (amPm === "AM" && numHour >= 1 && numHour <= 6) return true;
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
        if (
          isTimeSlotDisabled(
            selectedHour,
            selectedMinute,
            selectedAmPm,
            constructedDate,
          )
        ) {
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

      let hasActiveReservation = false;
      for (const docSnap of existingRes.docs) {
        const resData = docSnap.data();
        const resDateTime = new Date(`${resData.date}T${resData.time}`);
        const expirationTime = new Date(
          resDateTime.getTime() + 2 * 60 * 60 * 1000,
        );
        if (expirationTime < new Date()) {
          await deleteDoc(doc(db, "reservations", docSnap.id));
        } else {
          hasActiveReservation = true;
        }
      }

      if (hasActiveReservation) {
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
        { id: "S13", cap: 2 },
        { id: "S14", cap: 2 },
        { id: "S15", cap: 2 },
        { id: "S16", cap: 2 },
        { id: "S17", cap: 2 },
        { id: "S25", cap: 3 },
        { id: "S26", cap: 3 },
        { id: "S27", cap: 3 },
        { id: "S37", cap: 4 },
        { id: "S38", cap: 4 },
        { id: "S39", cap: 4 },
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
      } catch (emailError) {}

      toast.success(
        `Confirmed! Table ${assignedTable.id} secured for ${formattedDate}.`,
      );
      navigate("/dashboard");
    } catch (error) {
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
            <div className="flex flex-col relative pb-4">
              <label className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mb-4 font-semibold">
                Party Size
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGuests(num)}
                    className={`py-3 text-xs uppercase tracking-wider transition-all duration-300 font-medium border ${guests === num ? "bg-stone-900 border-stone-900 text-white" : "border-stone-200 text-stone-800 hover:border-stone-900"}`}
                  >
                    {num === 10 ? "6-10" : num} {num === 1 ? "Guest" : "Guests"}
                  </button>
                ))}
              </div>
              {guests === 10 && (
                <p className="absolute bottom-0 left-0 text-[10px] text-[#D4AF37] tracking-widest uppercase">
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
                    <div className="absolute left-0 right-0 mt-1 max-h-[160px] overflow-y-auto bg-stone-900 text-white border border-stone-800 z-50 shadow-xl">
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
                              className={`w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors font-semibold border-b border-stone-800 ${disabled ? "text-stone-600 cursor-not-allowed bg-stone-950/40" : "hover:bg-[#D4AF37]"}`}
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
                              className={`w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors font-semibold border-b border-stone-800 ${disabled ? "text-stone-600 cursor-not-allowed bg-stone-950/40" : "hover:bg-[#D4AF37]"}`}
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
                              className={`w-full py-2.5 px-4 text-left text-xs tracking-wider transition-colors font-semibold border-b border-stone-800 ${disabled ? "text-stone-600 cursor-not-allowed bg-stone-950/40" : "hover:bg-[#D4AF37]"}`}
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      try {
        const resQuery = query(
          collection(db, "reservations"),
          where("userId", "==", currentUser.uid),
        );
        const resSnapshot = await getDocs(resQuery);

        let activeRes = null;
        for (const docSnap of resSnapshot.docs) {
          const docData = docSnap.data();
          const resDateTime = new Date(`${docData.date}T${docData.time}`);
          const expirationTime = new Date(
            resDateTime.getTime() + 2 * 60 * 60 * 1000,
          );
          if (expirationTime < new Date()) {
            await deleteDoc(doc(db, "reservations", docSnap.id));
          } else {
            activeRes = { id: docSnap.id, ...docData };
          }
        }
        setReservation(activeRes);

        const ordQuery = query(
          collection(db, "orders"),
          where("userId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
        );
        const ordSnapshot = await getDocs(ordQuery);
        setOrders(
          ordSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, navigate]);

  if (loading)
    return (
      <div className="pt-40 text-center min-h-screen">
        Loading your itinerary...
      </div>
    );

  return (
    <div className="animate-fade-in pt-40 pb-24 bg-[#FBFBF9] min-h-screen">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-serif tracking-widest uppercase text-stone-900 mb-6">
            Member Dashboard
          </h2>
          <p className="text-stone-500 font-medium tracking-widest text-sm uppercase">
            Welcome, {currentUser?.displayName || currentUser?.email}
          </p>
        </div>

        <div className="mb-16">
          <h3 className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] mb-6 font-semibold border-b border-stone-200 pb-2">
            Active Reservation
          </h3>
          {!reservation ? (
            <div className="bg-white border border-stone-200 p-8 text-center shadow-sm">
              <p className="text-stone-500 mb-6 tracking-wide text-sm">
                No upcoming dining experiences scheduled.
              </p>
              <Link
                to="/reservation"
                className="bg-stone-900 text-white px-8 py-3 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] transition-colors font-medium"
              >
                Secure a Table
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 p-8 shadow-sm relative">
              <div className="absolute top-0 right-0 bg-[#D4AF37] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 m-6">
                {reservation.status}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
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
                  <p className="text-xs text-[#D4AF37] mt-1">
                    {reservation.area}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] mb-6 font-semibold border-b border-stone-200 pb-2">
            Delivery Orders
          </h3>
          {orders.length === 0 ? (
            <div className="bg-white border border-stone-200 p-8 text-center shadow-sm">
              <p className="text-stone-500 tracking-wide text-sm mb-6">
                You have no recent delivery orders.
              </p>
              <Link
                to="/menu"
                className="bg-stone-900 text-white px-8 py-3 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] transition-colors font-medium"
              >
                Order Delivery
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-stone-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center"
                >
                  <div className="mb-4 md:mb-0">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">
                      Order #{order.id.slice(-6).toUpperCase()}
                    </p>
                    <p className="font-serif text-lg text-stone-900 mb-1">
                      {formatPrice(order.total)}{" "}
                      <span className="text-xs font-sans text-stone-500 tracking-wide ml-2">
                        via {order.paymentMethod}
                      </span>
                    </p>
                    <p className="text-xs text-stone-500 font-medium">
                      {order.items
                        .map((i) => `${i.quantity}x ${i.name}`)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
    const timer = setTimeout(
      () => setCurrentSlide((prev) => (prev + 1) % pointers.length),
      6000,
    );
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
              crafted with a reverence for culinary history.
            </p>
            <Link
              to="/menu"
              className="inline-block border border-[#D4AF37] text-[#D4AF37] px-10 py-4 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] hover:text-white transition-all duration-500 font-medium"
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
            <h4 className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] mb-4 font-medium">
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
                <p className="font-serif text-xl tracking-widest uppercase text-[#D4AF37] drop-shadow-md">
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
            <h4 className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] mb-4 font-medium">
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
              className="inline-block bg-stone-900 text-white px-12 py-5 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] transition-all duration-500 font-medium"
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
  const { addToCart } = useCart();

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
            <div className="w-8 h-px bg-[#D4AF37]"></div>
            <span className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] font-medium">
              Epicurean Mastery
            </span>
            <div className="w-8 h-px bg-[#D4AF37]"></div>
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
            <h3 className="text-2xl font-serif tracking-widest text-[#D4AF37] text-center uppercase mb-12 border-b border-stone-200 pb-4">
              {category.title}
            </h3>
            <div className="space-y-10">
              {category.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row justify-between items-start md:items-center group cursor-default p-4 border border-transparent hover:border-stone-200 hover:bg-white transition-all"
                >
                  <div className="md:w-3/4 pr-4">
                    <h4 className="text-xl font-serif tracking-wider text-stone-900 mb-2">
                      {item.name}
                    </h4>
                    <p className="text-sm font-medium text-stone-500 tracking-wide leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="mt-6 md:mt-0 flex-shrink-0 flex items-center justify-between w-full md:w-auto md:space-x-8">
                    <span className="text-lg font-serif text-[#D4AF37] tracking-widest">
                      {item.price}
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      className="border border-stone-300 px-6 py-2 text-xs uppercase tracking-widest font-semibold text-stone-800 hover:bg-[#D4AF37] hover:text-white hover:border-[#D4AF37] transition-colors"
                    >
                      + Order
                    </button>
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
      toast.error("Failed to send inquiry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in pt-40 pb-24 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row gap-16">
        <div className="lg:w-1/2">
          <h2 className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] mb-4 font-medium">
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
              <p className="text-[#D4AF37] uppercase mb-1">The Address</p>
              <p className="text-stone-800">
                1 JBS Haldane Avenue, Tangra
                <br />
                Kolkata, West Bengal 700046
              </p>
            </div>
            <div>
              <p className="text-[#D4AF37] uppercase mb-1">Direct Line</p>
              <p className="text-stone-800">+91 33 4446 4646</p>
            </div>
            <div>
              <p className="text-[#D4AF37] uppercase mb-1">Email</p>
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
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-[#D4AF37] transition-colors font-medium text-stone-800"
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
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-[#D4AF37] transition-colors font-medium text-stone-800"
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
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-[#D4AF37] transition-colors font-medium text-stone-800 appearance-none"
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
                className="bg-transparent border-b border-stone-300 py-2 focus:outline-none focus:border-[#D4AF37] transition-colors font-medium text-stone-800 resize-none"
                placeholder="How may we assist you?"
              ></textarea>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-stone-900 text-white px-8 py-4 uppercase tracking-[0.2em] text-xs hover:bg-[#D4AF37] transition-all duration-500 font-medium mt-4 disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Submit Inquiry"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const Concierge = () => {
  const curators = [
    {
      id: 1,
      name: "Alistair Sterling",
      role: "Executive Head Chef",
      quote:
        "Perfection is not an act; it is a relentless, unforgiving habit. Every plate that leaves this kitchen carries a piece of my soul and centuries of culinary discipline.",
      signature: "The Imperial Tasting Menu",
      image:
        "https://images.unsplash.com/photo-1583394838336-acd977736f90?q=80&w=1968&auto=format&fit=crop",
    },
    {
      id: 2,
      name: "Isabella Rossi",
      role: "Master Patissier",
      quote:
        "Sugar is merely the medium. My true ingredients are memory, structure, and fleeting moments of pure, unadulterated joy. A dessert should be as transient as a dream.",
      signature: "Saffron Pistachio Kulfi",
      image:
        "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2070&auto=format&fit=crop",
    },
    {
      id: 3,
      name: "Vikram Aditya",
      role: "Royal Kitchen Historian",
      quote:
        "I do not invent recipes; I resurrect them. The spices we use were once traded for empires. Cooking here is an act of historical preservation, executed over charcoal and fire.",
      signature: "Sikandari Raan Reserve",
      image:
        "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?q=80&w=1977&auto=format&fit=crop",
    },
    {
      id: 4,
      name: "Julian Moreau",
      role: "Head Sommelier",
      quote:
        "A bottle of wine is a time capsule. My duty is to unlock the exact year, terroir, and weather that perfectly harmonizes with the flame-kissed ingredients on your plate.",
      signature: "Bordeaux Heritage Pairing",
      image:
        "https://images.unsplash.com/photo-1559564034-2e9121703666?q=80&w=2070&auto=format&fit=crop",
    },
    {
      id: 5,
      name: "Daisuke Tanaka",
      role: "Asian Fusion Master",
      quote:
        "The knife must move with intention, never hesitation. Respect the ocean, respect the ingredient, and the dish will ultimately speak for itself.",
      signature: "Omakase Reserve",
      image:
        "https://images.unsplash.com/photo-1581299894007-aaa502973166?q=80&w=1974&auto=format&fit=crop",
    },
  ];

  return (
    <div className="animate-fade-in pt-40 pb-24 bg-[#FBFBF9] min-h-screen">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="text-center mb-24 md:mb-32">
          <h4 className="text-xs tracking-[0.3em] uppercase text-[#D4AF37] mb-4 font-semibold">
            The Architects of Taste
          </h4>
          <h2 className="text-4xl md:text-6xl font-serif tracking-widest uppercase text-stone-900 mb-6">
            Our Concierge
          </h2>
          <div className="w-16 h-px bg-stone-300 mx-auto"></div>
        </div>

        <div className="flex flex-col">
          {curators.map((curator, index) => (
            <div
              key={curator.id}
              className={`flex flex-col lg:flex-row items-center gap-0 lg:gap-16 mb-24 lg:mb-32 ${index % 2 !== 0 ? "lg:flex-row-reverse" : ""}`}
            >
              <div className="w-full lg:w-1/2 relative h-[400px] lg:h-[600px] overflow-hidden group bg-stone-900">
                <img
                  src={curator.image}
                  alt={curator.name}
                  className="w-full h-full object-cover grayscale opacity-90 group-hover:grayscale-0 group-hover:scale-105 group-hover:opacity-100 transition-all duration-[1500ms]"
                />
                <div className="absolute inset-0 border border-white/20 m-6 pointer-events-none transition-all duration-[1500ms] group-hover:m-4"></div>
              </div>
              <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-0">
                <div className="w-12 h-px bg-[#D4AF37] mb-8"></div>
                <h4 className="text-[10px] tracking-[0.3em] uppercase text-[#D4AF37] mb-4 font-bold">
                  {curator.role}
                </h4>
                <h3 className="text-3xl md:text-5xl font-serif text-stone-900 mb-8 uppercase tracking-widest leading-tight">
                  {curator.name}
                </h3>
                <p className="text-stone-500 font-medium leading-relaxed tracking-[0.1em] text-sm md:text-base italic mb-10 border-l border-stone-200 pl-6">
                  &quot;{curator.quote}&quot;
                </p>
                <div className="text-[9px] tracking-[0.2em] uppercase text-stone-900 font-bold bg-stone-100 self-start px-4 py-2 border border-stone-200">
                  Signature:{" "}
                  <span className="text-stone-500 ml-2">
                    {curator.signature}
                  </span>
                </div>
              </div>
            </div>
          ))}
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
          className="text-stone-500 hover:text-[#D4AF37] transition-colors tracking-widest text-xs uppercase font-medium"
        >
          Instagram
        </a>
        <span className="text-stone-300">|</span>
        <a
          href="#"
          className="text-stone-500 hover:text-[#D4AF37] transition-colors tracking-widest text-xs uppercase font-medium"
        >
          Facebook
        </a>
        <span className="text-stone-300">|</span>
        <Link
          to="/concierge"
          className="text-stone-500 hover:text-[#D4AF37] transition-colors tracking-widest text-xs uppercase font-medium"
        >
          Concierge
        </Link>
      </div>
      <p className="text-[10px] tracking-[0.2em] text-stone-400 uppercase font-medium">
        © 2026 The Restro-Cafe Luxury Collection. All Rights Reserved.
      </p>
    </footer>
  );
};

export default App;
