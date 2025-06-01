// src/pages/orderconfirm/oc.js (or your OrderConfirmation.js path)
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './oc.css'; // Make sure this CSS file exists and is styled
import receiptImage from './ocassets/RCPT.png'; // For fallback print

// If item.image in the received orderData.items is just a filename string
// (e.g., if CheckoutPage passed items from backend response directly WITHOUT mapping ImagePath to imported image variable)
// AND you are using the "images in src/assets" strategy, you would need
// to import all images and use an imageMap here, similar to ProductDetail.js.
// **However, the recommended approach is that CheckoutPage.js constructs orderData.items
// where item.image is ALREADY the imported image variable.**

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const { state } = useLocation(); // This contains the data passed from CheckoutPage

  const defaultOrderData = {
    orderId: 'N/A',
    items: [],
    finalTotal: 0,
    orderDate: new Date().toLocaleDateString(),
    paymentMethod: 'N/A',
    merchandiseSubtotal: 0,
    shippingFee: 0,
    appliedDiscountAmount: 0,
    customerDetails: { shippingAddress: "Not available" }
  };

  const orderData = state?.orderData || defaultOrderData;

  useEffect(() => {
    console.log("%cOrderConfirmation: Component Mounted or location.state changed.", "color: blue; font-weight: bold;");
    console.log("Full location.state received:", JSON.stringify(state, null, 2));

    if (state && state.orderData) {
      console.log("Effective orderData being used by component (from state):", JSON.stringify(state.orderData, null, 2));
      if (state.orderData.items && Array.isArray(state.orderData.items) && state.orderData.items.length > 0) {
        console.log("Items to be displayed (from state.orderData.items):", JSON.stringify(state.orderData.items, null, 2));
      } else {
        console.warn("Received orderData in state, but its 'items' array is empty, missing, or not an array.", state.orderData.items);
      }
    } else {
      console.warn("No orderData found in location.state. Component will use defaultOrderData.");
      console.log("Using defaultOrderData:", JSON.stringify(defaultOrderData, null, 2));
    }
  }, [state]); 

  const [isCanceled, setIsCanceled] = useState(false);

  const handlePrintOrder = () => {
    const printWindow = window.open('', '_blank', 'height=800,width=750');
    printWindow.document.write('<html><head><title>Metalworks Order Receipt</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
      body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.5; color: #333; }
      .print-container { width: 100%; max-width: 700px; margin: 0 auto; }
      .print-header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 10px;}
      .print-header h1 { margin: 0; color: #2c3e50; }
      .order-meta-info p { margin: 3px 0; font-size: 0.9em; }
      .section-title { font-size: 1.2em; font-weight: bold; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;}
      .shipping-details p, .customer-details p { margin: 2px 0; }
      .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em; }
      .items-table th { background-color: #f9f9f9; }
      .items-table img { max-width: 40px; max-height: 40px; vertical-align: middle; margin-right: 5px; object-fit: contain; }
      .item-name-col { width: 40%; }
      .item-qty-col, .item-unit-price-col { width: 15%; text-align: center; }
      .item-total-col { width: 20%; text-align: right; }
      .totals-section { margin-top: 20px; width: 100%; }
      .totals-table { width: 50%; margin-left: auto; border-collapse: collapse; } /* Align to right */
      .totals-table td { padding: 6px; font-size: 0.95em; }
      .totals-table td:first-child { text-align: right; padding-right: 15px; }
      .totals-table td:last-child { text-align: right; font-weight: bold; }
      .final-total-row td { border-top: 2px solid #333; font-size: 1.1em; padding-top: 10px !important; }
      .rush-tag-print { font-size: 0.8em; color: #e67e22; font-style: italic; }
      @media print {
        body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } /* Ensures background colors print */
        .no-print { display: none; }
      }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write('<div class="print-container">');
    printWindow.document.write('<div class="print-header"><h1>Order Receipt - Metalworks</h1></div>');
    
    // Order Meta Information
    printWindow.document.write('<div class="order-meta-info section-title">');
    printWindow.document.write(`<h3>Order No. ${orderData.orderId}</h3>`);
    printWindow.document.write(`<p><strong>Date:</strong> ${new Date(orderData.orderDate || Date.now()).toLocaleDateString()}</p>`);
    printWindow.document.write(`<p><strong>Payment Method:</strong> ${orderData.paymentMethod}</p>`);
    printWindow.document.write('</div>');

    // Shipping Information
    printWindow.document.write('<div class="shipping-details section-title">');
    printWindow.document.write('<h3>Shipping To:</h3>');
    printWindow.document.write(`<p>${orderData.customerDetails?.name || 'Valued Customer'}</p>`);
    printWindow.document.write(`<p>${orderData.customerDetails?.shippingAddress || "Customer Address Not Provided"}</p>`);
    printWindow.document.write('</div>');

    // Items List
    printWindow.document.write('<div class="items-list-print section-title"><h3>Items Ordered:</h3></div>');
    printWindow.document.write('<table class="items-table"><thead><tr>');
    printWindow.document.write('<th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th>');
    printWindow.document.write('</tr></thead><tbody>');
    if (orderData.items && orderData.items.length > 0) {
      orderData.items.forEach(item => {
        printWindow.document.write('<tr>');
        printWindow.document.write(`<td class="item-name-col"><img src="${item.image || '/placeholder.png'}" alt="${item.name || ''}" /> ${item.name || 'N/A'} ${item.rushOrder ? '<span class="rush-tag-print">(Rush)</span>' : ''}</td>`);
        printWindow.document.write(`<td class="item-qty-col">${item.quantity || 0}</td>`);
        printWindow.document.write(`<td class="item-unit-price-col">₱ ${(Number(item.price) || 0).toFixed(2)}</td>`);
        printWindow.document.write(`<td class="item-total-col">₱ ${(Number(item.totalItemPrice) || 0).toFixed(2)}</td>`);
        printWindow.document.write('</tr>');
      });
    } else {
      printWindow.document.write('<tr><td colspan="4">No items in this order.</td></tr>');
    }
    printWindow.document.write('</tbody></table>');

    // Order Totals
    printWindow.document.write('<div class="totals-section section-title"><h3>Summary:</h3></div>');
    printWindow.document.write('<table class="totals-table"><tbody>');
    printWindow.document.write(`<tr><td>Merchandise Subtotal:</td><td>₱ ${(Number(orderData.merchandiseSubtotal) || 0).toFixed(2)}</td></tr>`);
    printWindow.document.write(`<tr><td>Shipping Fee:</td><td>₱ ${(Number(orderData.shippingFee) || 0).toFixed(2)}</td></tr>`);
    if (orderData.appliedDiscountAmount > 0) {
      printWindow.document.write(`<tr><td>Discount:</td><td>- ₱ ${(Number(orderData.appliedDiscountAmount) || 0).toFixed(2)}</td></tr>`);
    }
    printWindow.document.write(`<tr class="final-total-row"><td>Total Payment:</td><td>₱ ${(Number(orderData.finalTotal) || 0).toFixed(2)}</td></tr>`);
    printWindow.document.write('</tbody></table>');

    printWindow.document.write('</div>'); // End of print-container
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { 
        printWindow.print();
        printWindow.close();
    }, 750); 
  };

  const handleCancelOrder = () => { 
    console.log("Attempting to cancel order:", orderData.orderId);
    setIsCanceled(true);
    alert(`Order ${orderData.orderId} cancellation requested (Demo Feature).`);
  };
  const handleTrackOrder = () => navigate('/ordertrack', { state: { orderId: orderData.orderId } });

  if (orderData === defaultOrderData && (!state || !state.orderData)) {
      return (
          <div className="order-confirmation-container">
              <div className="confirmation-content">
                  <h1 className="confirmation-title">Order Information Not Found</h1>
                  <p>We could not retrieve your order details. This might happen if you refreshed this page or navigated here directly.</p>
                  <p>Please check your email for confirmation or <Link to="/products">continue shopping</Link>.</p>
              </div>
          </div>
      );
  }

  return ( 
    <div className="order-confirmation-container">
      <div className="confirmation-content">
        <h1 className="confirmation-title">Your order has been forged!</h1>
        <div className="order-summary-box">
          <h2>Order Summary</h2>
          <div className="order-number">
            <h3>Order No. {orderData.orderId}</h3>
            <p>Date: {new Date(orderData.orderDate || Date.now()).toLocaleDateString()}</p>
            <p>Payment Method: {orderData.paymentMethod}</p>
            <p>We've sent a confirmation email with your order details (simulated).</p>
          </div>
        </div>
        {/* This ID is for the on-screen display, not directly for printing with the new method */}
        <div id="order-receipt-display-area"> 
            <div className="order-details"> 
            <h2>Order Details</h2>
            <div className="shipping-info">
                <h3>Shipping To:</h3>
                <p>{orderData.customerDetails?.shippingAddress || "Customer Address Not Provided"}</p>
            </div>
            <div className="items-list">
                <h3>Items:</h3>
                {orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0 ? (
                    orderData.items.map((item, index) => (
                    <div className="item" key={`${item.id}-${index}-${item.rushOrder || ''}`}> 
                        <div className="item-image-container"> 
                            <img 
                                src={item.image || '/placeholder.png'} 
                                alt={item.name || 'Product Image'} 
                                className="item-image-oc" 
                            />
                        </div>
                        <div className="item-info-oc">
                            <span className="item-name-oc">{item.name || 'N/A'}</span>
                            {item.rushOrder && <span className="rush-tag-oc">(Rush Order)</span>}
                            <span className="item-qty-oc">Qty: {item.quantity || 0}</span>
                        </div>
                        <div className="item-price-oc">
                            <span>Unit: ₱ {(Number(item.price) || 0).toFixed(2)}</span>
                            <span>Total: ₱ {(Number(item.totalItemPrice) || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    ))
                ) : ( 
                    <p>No items were found in this order confirmation.</p> 
                )}
            </div>
            <div className="order-total"> 
                <h3>Order Total:</h3>
                <div className="total-line"><span>Merchandise Subtotal</span><span>₱ {(Number(orderData.merchandiseSubtotal) || 0).toFixed(2)}</span></div>
                <div className="total-line"><span>Shipping Fee</span><span>₱ {(Number(orderData.shippingFee) || 0).toFixed(2)}</span></div>
                {orderData.appliedDiscountAmount > 0 && (<div className="total-line discount-line"><span>Promo Code Discount</span><span>- ₱ {(Number(orderData.appliedDiscountAmount) || 0).toFixed(2)}</span></div>)}
                <div className="total-line final-total"><span>Total Payment:</span><span>₱ {(Number(orderData.finalTotal) || 0).toFixed(2)}</span></div>
            </div>
            </div>
        </div> 
        <div className="order-actions"> 
          <button className="action-btn print-btn" onClick={handlePrintOrder}>Print Order Details</button>
          <button className="action-btn track-btn" onClick={handleTrackOrder}>Track My Order</button>
          {!isCanceled && (<button className="action-btn cancel-btn" onClick={handleCancelOrder}>Cancel Order (Demo)</button>)}
        </div>
         <Link to="/products" className="continue-shopping-link-oc">Continue Shopping</Link>
      </div>
      {isCanceled && (<div className="cancel-notification">Order ({orderData.orderId}) Cancellation Request Submitted (Demo).</div>)}
    </div>
  );
};
export default OrderConfirmation;
