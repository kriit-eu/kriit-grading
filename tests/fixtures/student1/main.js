// Student 1's solution
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

function formatCurrency(amount) {
  return `$${amount.toFixed(2)}`;
}

module.exports = { calculateTotal, formatCurrency };
