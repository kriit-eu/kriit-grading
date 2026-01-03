// Student 2's solution (copied from student 1)
function computeSum(products) {
  let sum = 0;
  for (const product of products) {
    sum += product.price * product.quantity;
  }
  return sum;
}

function displayMoney(value) {
  return `$${value.toFixed(2)}`;
}

module.exports = { computeSum, displayMoney };
