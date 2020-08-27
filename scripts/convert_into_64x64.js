const alpha = 0.0047021;
const beta_one = 13783.9757;
const beta_two = 2.446*10**(-5);
const theta = 0.002;

// convert into 64.64 bit fixed_point
function convert(coeff)  {
    return "0x" + (coeff*2**64).toString(16).toUpperCase();
}

console.log(`ALPHA: ${convert(alpha)}, origin: ${alpha}`);
console.log(`BETA_ONE: ${convert(beta_one)}, origin: ${beta_one}`);
console.log(`BETA_TWO: ${convert(beta_two)}, origin: ${beta_two}`);
console.log(`THETA: ${convert(theta)}, origin: ${theta}`);
