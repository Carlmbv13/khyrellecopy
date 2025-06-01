// src/pages/ordertracking/ot.js (or your TrackOrder.js path)
import React, { useEffect, useState } from 'react'; // Added useEffect, useState
import './ot.css'; // Make sure this CSS file exists and is styled
import { useNavigate, useLocation, Link } from 'react-router-dom'; // Added Link, useLocation
import { useAuth } from '../../data/AuthProvider'; // Adjust path to your AuthProvider.js

const TrackOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoadingAuth } = useAuth(); // Get user details from AuthContext

  // State to hold order details, including what's passed via navigation
  const [orderDetails, setOrderDetails] = useState({
    orderId: 'N/A',
    recipientName: 'Loading...',
    recipientEmail: 'Loading...'
    // You might fetch more details based on orderId if needed
  });

  // Current status of the order - this would ideally come from backend based on orderId
  const [currentStatus, setCurrentStatus] = useState('sorting'); // Example: 'created', 'picked', 'sorting', 'delivery', 'delivered'
  
  // Static delivery log for now, in a real app this would be fetched based on orderId
  const deliveryLogEntries = [
    { time: '18 Apr 2025 | 10:10 AM', location: '[Parañaque DC]', message: 'Your order has been picked up from our forge', status: 'picked'},
    { time: '18 Apr 2025 – 10:10 AM', location: '[Parañaque DC]', message: 'Package picked up by our dwarven couriers', status: 'picked'},
    { time: '18 Apr 2025 – 08:45 AM', location: '[Blacksmiths Workshop]', message: 'Item quenched and packaged', status: 'created'},
    { time: '17 Apr 2025 – 03:20 PM', location: '[Blacksmiths Workshop]', message: 'Steel passed the hammer test', status: 'created'},
    { time: '17 Apr 2025 – 09:00 AM', location: '[Blacksmiths Workshop]', message: 'Production completed', status: 'created'},
    { time: '16 Apr 2025 – 01:10 PM', location: null, message: 'Order confirmed with blood seal', status: 'created'},
  ];


  useEffect(() => {
    if (!isLoadingAuth) { // Wait for auth state to be resolved
      if (!isAuthenticated) {
        // If user is not authenticated, redirect to login, optionally passing intended destination
        navigate('/login', { state: { from: location, message: "Please login to track your order." } });
        return;
      }

      // Get orderId from navigation state passed by OrderConfirmation.js
      const passedOrderId = location.state?.orderId;

      if (passedOrderId && user) {
        setOrderDetails({
          orderId: passedOrderId,
          recipientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
          recipientEmail: user.email || user.userEmail || 'N/A' // Handle variations in email field name
        });
        // TODO: In a real application, you would make an API call here
        // using 'passedOrderId' and 'user.CustomerID' to fetch the actual
        // current status and detailed delivery log for this specific order from your backend.
        // For now, we are using a static 'currentStatus' and 'deliveryLogEntries'.
        // Example: fetchOrderStatus(passedOrderId).then(statusData => setCurrentStatus(statusData.currentStatus));
      } else if (!passedOrderId) {
        console.warn("TrackOrder: No orderId received in location state.");
        setOrderDetails(prev => ({ ...prev, orderId: "Not Provided", recipientName: "N/A", recipientEmail: "N/A" }));
      }
    }
  }, [location.state, user, isAuthenticated, isLoadingAuth, navigate]);

  const handleBack = () => {
    // Navigate back to order confirmation if orderId is known, otherwise to products or home
    if (orderDetails.orderId && orderDetails.orderId !== 'N/A' && orderDetails.orderId !== 'Not Provided') {
      navigate('/orderconfirm', { state: { orderData: { orderId: orderDetails.orderId } } }); // Pass back minimal state
    } else {
      navigate('/products'); // Fallback navigation
    }
  };

  const statusLevels = ['created', 'picked', 'sorting', 'delivery', 'delivered'];
  const currentStatusIndex = statusLevels.indexOf(currentStatus);

  const statusIcons = {
    created: '⚒️',
    picked: '📦',
    sorting: '🔍',
    delivery: '🏍️',
    delivered: '✅'
  };

  if (isLoadingAuth) {
    return <div className="track-order-container"><div className="track-order-content"><p>Loading authentication...</p></div></div>;
  }
  
  // If not authenticated after loading, ProtectedRoute in App.js should handle it,
  // but this is an additional check if user lands here directly.
  if (!isAuthenticated) {
     return (
        <div className="track-order-container">
            <div className="track-order-content">
                <p>You need to be logged in to track an order.</p>
                <Link to="/login">Go to Login</Link>
            </div>
        </div>
     );
  }


  return (
    <div className="track-order-container">
      <div className="track-order-content">
        <button className="back-button" onClick={handleBack}>
          ⬅ Back
        </button>

        <h2 className="pixel-title">⚔️ Order Tracking ⚔️</h2>
        
        <div className="status-bar">
          {statusLevels.map((status, index) => (
            <div 
              key={status} 
              className={`step ${index < currentStatusIndex ? 'completed' : ''} ${index === currentStatusIndex ? 'active' : ''}`}
            >
              {statusIcons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
            </div>
          ))}
        </div>

        <div className="metal-border">
          <div className="order-section">
            <div className="order-info">
              <h3>🔧 Order Information</h3>
              <p><strong>Order Number:</strong> {orderDetails.orderId}</p>
              <p><strong>Recipient Name:</strong> {orderDetails.recipientName}</p>
              <p><strong>Recipient Email:</strong> {orderDetails.recipientEmail}</p>
              <div className="anvil-icon">⚒️</div>
            </div>

            <div className="delivery-status">
              <h3>📜 Delivery Log</h3>
              <ul>
                {deliveryLogEntries
                  .filter(entry => statusLevels.indexOf(entry.status) <= currentStatusIndex) // Show only relevant past/current logs
                  .map((log, index) => (
                  <li key={index}>
                    <span className="time">{log.time}</span> – 
                    {log.location && <strong> {log.location}</strong>} {log.message}
                  </li>
                ))}
                {currentStatusIndex < statusLevels.length -1 && <li><span className="time">Next update...</span> – Awaiting next scan</li>}
              </ul>
            </div>
          </div>
        </div>
        
        <div className="forge-effects">
          <div className="sparks"></div>
          <div className="sparks"></div>
        </div>
      </div>
    </div>
  );
};

export default TrackOrder;
