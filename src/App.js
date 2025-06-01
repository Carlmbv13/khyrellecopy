import './App.css';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import About from './pages/About/About';
import Contact from './pages/Contact/Contact';
import List from './pages/List/List';
import Search from './Components/Header/Search/Search';
import Header from './Components/Header/Header';
import Footer from './Components/Footer/Footer';
import ShoppingCart from './pages/ShoppingCart/ShoppingCart.js';
import Dashboard from './pages/Dashboard/Dashboard.js';
import FAQ from './pages/FAQ/Faq.js';
import TermsAndConditions from './pages/TermsAndConditions/TermsAndConditions.js';
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy.js';
import Checkout from './pages/checkout/co.js'; 
import OrderConfirm from './pages/orderconfirm/oc.js';
import OrderTrack from './pages/ordertracking/ot.js';
import ProductPage from './pages/ProductPage/ProductPages.js';
import ProductDetails from './pages/ProductDetail/ProductDetails.js';
import { CartProvider } from './data/CartProvider.js'
import Login from './pages/Login/Login.js';
import Home from './pages/Home/Home.js';
import Signup from './pages/Signup/Signup.js';
import { AuthProvider } from './data/AuthProvider'; // Adjust path

// Import background images

import defaultBg from './assets/bg2.png';
import homeBg from './assets/bg1.png';
import loginBg from './assets/bg1.png';
import aboutBg from './assets/bg2.png';
import cartBg from './assets/bg1.png';
import checkoutBg from './assets/2.png';
import productBg from './assets/4.png';

const BackgroundWrapper = ({ children }) => {
  const location = useLocation();
  
  const getBackgroundImage = () => {
    switch(location.pathname) {
      
      case '/':
        return homeBg;
      case '/about':
      case '/contact':
      case '/list':
        return aboutBg;
      
      case '/ShoppingCart':
        return cartBg;
      case '/product':
      case '/productdetails/:id':
        return productBg;
      case '/login':
      case '/signup':
        return loginBg;
      case '/checkout':
      case '/orderconfirm':
      case '/ordertrack':
        return checkoutBg;
      default:
        return defaultBg;
    }
  };

  return (
    <div 
      className="page-background"
      style={{
        backgroundImage: `url(${getBackgroundImage()})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {children}
    </div>
  );
};

function App() {
  return (
    <AuthProvider> {/* AuthProvider is at a high level */}
     <CartProvider>
    <Router>
      <BackgroundWrapper>
        <Header />
       
          <div className="main-content" style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home />}/>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/search" element={<Search />} />
              <Route path="/list" element={<List />} />
              <Route path="/ShoppingCart" element={<ShoppingCart />} />
              <Route path="/Dashboard" element={<Dashboard />} />
              <Route path="/FAQ" element={<FAQ />} />
              <Route path="/TermsAndConditions" element={<TermsAndConditions />} />
              <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orderconfirm" element={<OrderConfirm />} />
              <Route path="/ordertrack" element={<OrderTrack />} />
              <Route path="/product" element={<ProductPage />} />
              <Route path="/productdetails/:id" element={<ProductDetails />} />
            </Routes>
          </div>
          <Footer />
        
      </BackgroundWrapper>
    </Router></CartProvider>
    </AuthProvider> 
  );
}

export default App;