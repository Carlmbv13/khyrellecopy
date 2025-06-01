// src/pages/checkout/co.js (or your CheckoutPage.js path)
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './co.css'; // Make sure this CSS file exists and is styled
import { useCart } from '../../data/CartProvider'; // Adjust path to your CartProvider.js

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { 
    cartItems, 
    handleQuantityChange: updateCartQuantity, 
    handleRemoveItem: removeFromCart,
    clearCart 
  } = useCart();

  const [message, setMessage] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash On Delivery');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  const validPromoCode = 'METAL10'; 
  const promoDiscountPercentage = 0.10; 

  const merchandiseSubtotal = useMemo(() => (
    cartItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (item.quantity || 1)), 0)
  ), [cartItems]);

  const shipping = cartItems.length > 0 ? 100.00 : 0; 

  useEffect(() => {
    if (discountApplied) {
      setDiscountAmount(merchandiseSubtotal * promoDiscountPercentage);
    } else {
      setDiscountAmount(0);
    }
  }, [discountApplied, merchandiseSubtotal, promoDiscountPercentage]);
  
  const totalPayment = merchandiseSubtotal + shipping - discountAmount;

  const applyDiscount = () => {
    if (!discountCode) {
      setPromoError('Please enter a promo code');
      return;
    }
    if (discountCode.trim().toUpperCase() === validPromoCode) {
      setDiscountApplied(true);
      setPromoError('');
    } else {
      setPromoError('Invalid promo code');
      setDiscountApplied(false);
      setDiscountAmount(0);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
        alert("Your cart is empty. Please add items before placing an order.");
        return;
    }
    setIsPlacingOrder(true);
    setOrderError('');

    const isRushOrderOverall = cartItems.some(item => item.rushOrder);

    const orderPayloadToBackend = {
      items: cartItems.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.price) || 0,
        isRushItem: item.rushOrder,
      })),
      paymentMethod: paymentMethod,
      finalTotal: totalPayment,
      isRushOrder: isRushOrderOverall,
      messageForSeller: message,
      discountCode: discountApplied ? discountCode : null,
      appliedDiscountAmount: discountAmount,
      merchandiseSubtotal: merchandiseSubtotal,
      shippingFee: shipping,
    };
    
    try {
      const apiUrl = `/api/orders`;
      console.log("CheckoutPage: Attempting to place order to URL:", apiUrl); 
      console.log("CheckoutPage: Sending this payload to backend:", JSON.stringify(orderPayloadToBackend, null, 2));


      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${yourAuthToken}` // Add if using token auth
        },
        body: JSON.stringify(orderPayloadToBackend)
      });

      const backendResponseData = await response.json(); 

      if (!response.ok) {
        // Log the raw response text if it's not JSON to see the HTML error
        if (response.headers.get("content-type") && !response.headers.get("content-type").includes("application/json")) {
            const textError = await response.text();
            console.error("Backend Error (Non-JSON Response):", textError);
        }
        throw new Error(backendResponseData.message || `Failed to place order. Status: ${response.status}`);
      }
      
      const orderDataForConfirmation = {
        orderId: backendResponseData.orderDetails.orderId,
        orderDate: backendResponseData.orderDetails.orderDate || new Date().toLocaleDateString(),
        paymentMethod: paymentMethod, 
        items: cartItems.map(item => ({ 
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: Number(item.price) || 0, 
          totalItemPrice: item.totalPrice, 
          image: item.image, 
          description: item.description,
          rushOrder: item.rushOrder,
          ImagePath: item.ImagePath 
        })),
        merchandiseSubtotal: merchandiseSubtotal,
        shippingFee: shipping,
        appliedDiscountAmount: discountAmount,
        finalTotal: totalPayment, 
        customerDetails: { 
            name: "Valued Customer", 
            shippingAddress: "CM Recto Ave. Lapasan, CDOC PH" 
        }
      };
      
      console.log("CheckoutPage: Data being SENT to confirmation:", JSON.stringify(orderDataForConfirmation, null, 2));

      if (typeof clearCart === 'function') {
        clearCart(); 
      } else {
        console.warn("clearCart function not available from useCart(). Cart may not be cleared.");
      }
      
      navigate('/orderconfirm', { 
        state: { 
          orderData: orderDataForConfirmation 
        } 
      });

    } catch (error) {
      console.error("Error placing order:", error);
      if (error.message.includes("Unexpected token '<'") || error.message.includes("Failed to parse JSON")) {
        setOrderError("Failed to communicate with the order server. The server sent an unexpected response. Please check backend logs.");
      } else {
        setOrderError(error.message || "An unexpected error occurred while placing your order.");
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="checkout-page">
      <main className="checkout-container">
        <h1>Checkout</h1>
        <p className="checkout-description">
          Review your order details, enter your delivery and payment info, and place your order to complete your purchase.
        </p>
        <div className="checkout-sections">
          <div className="order-items-section">
            <h2>Your Items</h2>
            {cartItems.length === 0 ? (
                <p>Your cart is empty. <Link to="/product">Continue Shopping</Link></p>
            ) : ( 
                cartItems.map(item => (
                  <div key={`${item.id}-${item.rushOrder}`} className="order-item">
                    <div className="item-image">
                      <img src={item.image || '/placeholder.png'} alt={item.name} />
                    </div>
                    <div className="item-details">
                      <div className="item-info">
                        <h3>{item.name}</h3>
                        <p className="item-description">{item.description}</p>
                        {item.rushOrder && <p className="rush-order-tag-checkout">Rush Order</p>}
                        <p className="item-price">₱ {(Number(item.price) || 0).toFixed(2)} / unit</p>
                      </div>
                      <div className="item-actions">
                        <div className="quantity-control">
                          <button onClick={() => updateCartQuantity(item.id, -1, item.rushOrder)}>-</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.id, 1, item.rushOrder)}>+</button>
                        </div>
                        <button className="remove-btn" onClick={() => removeFromCart(item.id, item.rushOrder)}>Remove</button>
                      </div>
                    </div>
                  </div>
                ))
            )}
            {cartItems.length > 0 && ( 
              <>
                <div className="message-section">
                  <label>Message for Seller (Optional):</label>
                  <textarea placeholder="Any special instructions for your order..." value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
                <div className="promo-section">
                  <div className="promo-input">
                    <input type="text" placeholder="Enter promo code" value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value);
                        setPromoError(''); 
                        if (discountApplied) { setDiscountApplied(false); setDiscountAmount(0); }
                      }}
                      disabled={discountApplied && discountCode === validPromoCode} />
                    <button className="apply-btn" onClick={applyDiscount} disabled={discountApplied && discountCode === validPromoCode}>
                      {discountApplied && discountCode === validPromoCode ? 'Applied' : 'Apply'}
                    </button>
                  </div>
                  {promoError && <p className="promo-error">{promoError}</p>}
                  {discountApplied && discountCode === validPromoCode && <p className="promo-success">Promo code applied! Discount: ₱ {discountAmount.toFixed(2)}</p>}
                </div>
              </>
            )}
          </div>
          {cartItems.length > 0 && ( 
            <div className="order-summary-section">
              <h2>Order Summary</h2>
              <table className="summary-table">
                <tbody>
                  <tr><td>Merchandise Subtotal</td><td>₱ {(Number(merchandiseSubtotal) || 0).toFixed(2)}</td></tr>
                  <tr><td>Shipping Fee</td><td>₱ {(Number(shipping) || 0).toFixed(2)}</td></tr>
                  {discountApplied && discountAmount > 0 && (<tr><td>Discount</td><td>- ₱ {(Number(discountAmount) || 0).toFixed(2)}</td></tr>)}
                  <tr className="total-row"><td><strong>Total Payment:</strong></td><td><strong>₱ {(Number(totalPayment) || 0).toFixed(2)}</strong></td></tr>
                </tbody>
              </table>
              <div className="payment-option-checkout">
                <span>Payment Option: </span>
                <div className="payment-selector">
                  <span>{paymentMethod}</span>
                  <button className="payment-toggle" onClick={() => setShowPaymentOptions(!showPaymentOptions)}>Change</button>
                  {showPaymentOptions && (
                    <div className="payment-dropdown">
                      {['Cash On Delivery', 'GCash', 'Credit/Debit Card'].map(method => (
                        <button key={method} onClick={() => { setPaymentMethod(method); setShowPaymentOptions(false); }}>{method}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {orderError && <p className="error-message" style={{color: 'red', marginTop: '10px'}}>{orderError}</p>}
              <button className="place-order-btn" onClick={handlePlaceOrder} disabled={isPlacingOrder}>
                {isPlacingOrder ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
export default CheckoutPage;
