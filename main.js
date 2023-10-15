import * as Plot from "@observablehq/plot";

class LiquidityPool {
  /**
   * Create a simplified constant product AMM liquidity pool (x*y==k).
   * @param {number} eth - The initial amount of ETH liquidity.
   * @param {number} revnetToken - The initial amount of Revnet Token liquidity.
   */
  constructor(eth, revnetToken) {
    this.eth = eth;
    this.revnetToken = revnetToken;
  }

  /**
   * @param {number} amount - The amount of ETH liquidity to provide.
   */
  provideEth(amount) {
    this.eth += amount;
  }

  /**
   * @param {number} amount - The amount of Revnet Token liquidity to provide.
   */
  provideRevnetTokens(amount) {
    this.revnetToken += amount;
  }

  /**
   * @return {number} The price of 1 ETH in terms of Revnet tokens.
   */
  getMarginalPriceOfEth() {
    return this.revnetToken / this.eth;
  }

  /**
   * @return {number} The price of 1 Revnet token in terms of ETH.
   */
  getMarginalPriceOfRevnetToken() {
    return this.eth / this.revnetToken;
  }

  /**
   * Calculate the amount of ETH that would be returned for a given amount of Revnet tokens.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens.
   * @return {number} The amount of ETH that would be returned.
   */
  getEthReturn(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken;
    let newRevnetTokenBalance = this.revnetToken + revnetTokenAmount;
    let newEthBalance = invariant / newRevnetTokenBalance;
    return this.eth - newEthBalance;
  }

  /**
   * Calculate the amount of Revnet tokens that would be returned for a given amount of ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @return {number} The amount of Revnet tokens that would be returned.
   */
  getRevnetTokenReturn(ethAmount) {
    const invariant = this.eth * this.revnetToken;
    let newEthBalance = this.eth + ethAmount;
    let newRevnetTokenBalance = invariant / newEthBalance;
    return this.revnetToken - newRevnetTokenBalance;
  }

  /**
   * Spend Revnet tokens to buy ETH.
   * @param {number} revnetTokenAmount - The amount of Revnet tokens to spend.
   * @return {number} The amount of ETH bought.
   */
  buyEth(revnetTokenAmount) {
    const invariant = this.eth * this.revnetToken;
    let newRevnetTokenBalance = this.revnetToken + revnetTokenAmount;
    let newEthBalance = invariant / newRevnetTokenBalance;
    let ethAmount = this.eth - newEthBalance;
    this.revnetToken = newRevnetTokenBalance;
    this.eth = newEthBalance;
    return ethAmount;
  }
  /**
   * Spend ETH to buy Revnet tokens.
   * @param {number} ethAmount - The amount of ETH to spend.
   * @returns {number} The amount of Revnet tokens bought.
   */
  buyRevnetTokens(ethAmount) {
    const invariant = this.eth * this.revnetToken;
    let newEthBalance = this.eth + ethAmount;
    let newRevnetTokenBalance = invariant / newEthBalance;
    let revnetTokenAmount = this.revnetToken - newRevnetTokenBalance;
    this.eth = newEthBalance;
    this.revnetToken = newRevnetTokenBalance;
    return revnetTokenAmount;
  }
}

class Revnet {
  /**
   * Create a simplified representation of a Revnet.
   * @param {number} priceCeilingIncreasePercentage - The percentage by which token issuance is reduced at the price ceiling increase frequency. 0-1.
   * @param {number} priceCeilingIncreaseFrequencyInDays - The frequency of price ceiling increase in days. Positive integer greater than zero.
   * @param {number} priceFloorTaxIntensity - The percentage curve of the price floor tax. 0-1.
   * @param {number} premintAmount - The amount of tokens preminted to the boost. Must be >= 0.
   * @param {number} boostPercent - The percentage of tokens routed to the boost. 0-1.
   * @param {number} boostDurationInDays - The duration of the boost in days. Positive integer greater than zero.
   * @param {Date} startDate - The start date of the Revnet.
   */
  constructor(
    priceCeilingIncreasePercentage,
    priceCeilingIncreaseFrequencyInDays,
    priceFloorTaxIntensity,
    premintAmount,
    boostPercent,
    boostDurationInDays
  ) {
    this.priceCeilingIncreasePercentage = priceCeilingIncreasePercentage;
    this.priceCeilingIncreaseFrequencyInDays =
      priceCeilingIncreaseFrequencyInDays;
    this.priceFloorTaxIntensity = priceFloorTaxIntensity;
    this.premintAmount = premintAmount;
    this.boostPercent = boostPercent;
    this.boostDurationInDays = boostDurationInDays;
    this.tokensSentToBoost = premintAmount;
    this.tokenSupply = premintAmount;
    this.ethBalance = 0;
    this.day = 0; // Start at day 0
  }

  /**
   * Get the number of tokens created per ETH at the Revnet's current day.
   * @return {number} The number of tokens created per ETH.
   */
  getTokensCreatedPerEth() {
    return Math.pow(
      1 - this.priceCeilingIncreasePercentage,
      Math.floor(this.day / this.priceCeilingIncreaseFrequencyInDays)
    );
  }
  /**
   * Get the amount of ETH which can currently be reclaimed by destroying a given number of tokens.
   * @param {number} tokensBeingDestroyed - The number of tokens being destroyed.
   * @return {number} The amount of ETH which can be reclaimed.
   */
  getEthReclaimAmount(tokensBeingDestroyed) {
    const ratioBeingDestroyed = tokensBeingDestroyed / this.tokenSupply;
    const intensityTerm =
      ratioBeingDestroyed * this.priceFloorTaxIntensity +
      1 -
      this.priceFloorTaxIntensity;
    return this.ethBalance * ratioBeingDestroyed * intensityTerm;
  }

  /**
   * Create tokens at the current ceiling price by paying in ETH.
   * @param {number} ethAmount - The amount of ETH.
   * @return {number} The number of tokens returned to the payer.
   */
  createTokensAtCeiling(ethAmount) {
    let tokenAmount = ethAmount * this.getTokensCreatedPerEth();
    this.ethBalance += ethAmount;
    this.tokenSupply += tokenAmount;
    if (this.day < this.boostDurationInDays) {
      this.tokensSentToBoost += tokenAmount * this.boostPercent;
      return tokenAmount * (1 - this.boostPercent);
    } else {
      return tokenAmount;
    }
  }

  /**
   * Destroy tokens at the floor price and return the amount of ETH reclaimed.
   * @param {number} tokenAmount - The amount of tokens to destroy.
   * @return {number} The amount of ETH reclaimed.
   */
  destroyTokensAtFloor(tokenAmount) {
    let ethAmount = this.getEthReclaimAmount(tokenAmount);
    this.tokenSupply -= tokenAmount;
    this.ethBalance -= ethAmount;
    return ethAmount;
  }

  /**
   * Get the current token price ceiling.
   * @return {number} The token price ceiling.
   */
  getPriceCeiling() {
    return 1 / this.getTokensCreatedPerEth();
  }

  /**
   * Get the number of tokens you need to destroy to reclaim a given amount of ETH.
   * @param {number} ethAmount The amount of ETH returned.
   * @return {number} The token price floor, or the number of tokens needed to reclaim ethAmount.
   */
  getTokensNeededToClaimEthAmount(ethAmount) {
    const sqrtTerm = Math.sqrt(
      this.ethBalance *
        (4 * this.priceFloorTaxIntensity * ethAmount +
          this.ethBalance -
          2 * this.priceFloorTaxIntensity * this.ethBalance +
          this.priceFloorTaxIntensity *
            this.priceFloorTaxIntensity *
            this.ethBalance)
    );

    const x1 =
      (-this.tokenSupply * this.ethBalance +
        this.priceFloorTaxIntensity * this.tokenSupply * this.ethBalance -
        this.tokenSupply * sqrtTerm) /
      (2 * this.priceFloorTaxIntensity * this.ethBalance);
    const x2 =
      (-this.tokenSupply * this.ethBalance +
        this.priceFloorTaxIntensity * this.tokenSupply * this.ethBalance +
        this.tokenSupply * sqrtTerm) /
      (2 * this.priceFloorTaxIntensity * this.ethBalance);

    return x1 > x2 ? x1 : x2;
  }

  incrementDay() {
    this.day += 1;
  }
}

class Trader {
  recordPurchase(ethSpent, revnetTokensReceived, source, day) {
    this.purchase = { ethSpent, revnetTokensReceived, source, day };
  }

  recordSale(revnetTokensSpent, ethReceived, source, day) {
    this.sale = { revnetTokensSpent, ethReceived, source, day };
  }
}

/**
 * Function to purchase Revnet tokens, routing payments to the most cost-effective option.
 * @param {number} ethSpent - The amount of ETH spent to purchase tokens.
 * @param {object} r - The Revnet object.
 * @param {object} p - The LiquidityPool object.
 * @param {object} t - The Trader object.
 * @returns {number} - The number of tokens purchased.
 */
function purchaseRevnetTokens(ethSpent, r, p, t) {
  let source, revnetTokensReceived;
  if (
    p.revnetToken > p.getRevnetTokenReturn(ethSpent) &&
    p.getRevnetTokenReturn(ethSpent) > r.getTokensCreatedPerEth() * ethSpent
  ) {
    revnetTokensReceived = p.buyRevnetTokens(ethSpent);
    source = "pool";
  } else {
    revnetTokensReceived = r.createTokensAtCeiling(ethSpent);
    source = "revnet";
  }
  return { revnetTokensReceived, source };
}

/**
 * Function to sell Revnet tokens, routing payments to the most cost-effective option.
 * @param {number} revnetTokensSpent - The amount of Revnet tokens spent to sell.
 * @param {object} r - The Revnet object.
 * @param {object} p - The LiquidityPool object.
 * @param {object} t - The Trader object.
 * @returns {number} - The amount of ETH received from selling tokens.
 */
function sellRevnetTokens(revnetTokensSpent, r, p, t) {
  let source,
    ethReceived = 0;
  if (
    p.eth > p.getEthReturn(revnetTokensSpent) &&
    p.getEthReturn(revnetTokensSpent) > r.getEthReclaimAmount(revnetTokensSpent)
  ) {
    source = "pool";
    ethReceived = p.buyEth(revnetTokensSpent);
  } else if (r.getEthReclaimAmount(revnetTokensSpent) < r.ethBalance) {
    source = "revnet";
    ethReceived = r.destroyTokensAtFloor(revnetTokensSpent);
  }

  return { ethReceived, source };

  if (source) t.recordSale(revnetTokensSpent, ethReceived, source, r.day);
  return ethReceived;
}

function poissonRandomNumber(lambda) {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= Math.random();
  } while (p > L);

  return k - 1;
}

function normalRandomNumber() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function logNormRandomNumber(mu = 0, sigma = 1.5) {
  return Math.exp(mu + sigma * normalRandomNumber());
}

function randomTrial() {
  let results = [];
  for (let i = 0; i < 100; i++) {
    results.push({
      index: i,
      poisson: poissonRandomNumber(i),
      normalRandomNumber: normalRandomNumber(),
      logvar1_1: logNormRandomNumber(1, 1),
      logvar0_1: logNormRandomNumber(0, 1),
      logvar0_15: logNormRandomNumber(0, 1.5),
    });
  }

  console.table(results);
}
// randomTrial();

// Simulation metaparameters
/*
const daysToCalculate = 100; // The number of days to simulate for (10 - 100)
const dailyTradesLambda = 5; // The lambda used in a poisson distribution for the number of daily trades

const purchaseAmountMean = 0; // The lognorm mean for the amount in a trade
const purchaseAmountVariance = 1.5; // The lognorm variance for the amount in a trade

const revnetTokenLiquidityRatio = 0.1; // The percentage of tokens made available on secondary markets once they are purchased.
const ethLiquidityRatio = 0.1; // The percentage of eth made available on secondary markets once it is purchased
*/

function simulate() {
  // Get values from inputs
  let priceCeilingIncreaseFrequencyInDays = Number(
    document.getElementById("priceCeilingIncreaseFrequencyInDays").value
  );
  let priceCeilingIncreasePercentage = Number(
    document.getElementById("priceCeilingIncreasePercentage").value
  );
  let priceFloorTaxIntensity = Number(
    document.getElementById("priceFloorTaxIntensity").value
  );
  let boostPercent = Number(document.getElementById("boostPercent").value);
  let boostDurationInDays = Number(
    document.getElementById("boostDurationInDays").value
  );
  let premintAmount = Number(document.getElementById("premintAmount").value);
  let eth = Number(document.getElementById("eth").value);
  let revnetToken = Number(document.getElementById("revnetToken").value);
  let daysToCalculate = Number(
    document.getElementById("daysToCalculate").value
  );
  let dailyPurchasesLambda = Number(
    document.getElementById("dailyPurchasesLambda").value
  );
  let purchaseAmountMean = Number(
    document.getElementById("purchaseAmountMean").value
  );
  let purchaseAmountVariance = Number(
    document.getElementById("purchaseAmountVariance").value
  );
  let revnetTokenLiquidityRatio = Number(
    document.getElementById("revnetTokenLiquidityRatio").value
  );
  let ethLiquidityRatio = Number(
    document.getElementById("ethLiquidityRatio").value
  );
  let saleProbability = Number(
    document.getElementById("saleProbability").value
  );

  const r = new Revnet(
    priceCeilingIncreasePercentage,
    priceCeilingIncreaseFrequencyInDays,
    priceFloorTaxIntensity,
    premintAmount,
    boostPercent,
    boostDurationInDays
  );
  const p = new LiquidityPool(eth, revnetToken);
  if (revnetToken) r.tokenSupply += revnetToken; // Add initial liquidity pool supply to outstanding token supply.
  const traders = [];
  const simulationResults = [];

  for (; r.day < daysToCalculate; r.incrementDay()) {
    // Make purchases
    let dailyPurchases = [];
    for (let i = 0; i < poissonRandomNumber(dailyPurchasesLambda); i++) {
      let t = new Trader();
      let ethSpent = logNormRandomNumber(
        purchaseAmountMean,
        purchaseAmountVariance
      );
      let { revnetTokensReceived, source } = purchaseRevnetTokens(
        ethSpent,
        r,
        p,
        t
      );
      t.recordPurchase(ethSpent, revnetTokensReceived, source, r.day);
      p.provideRevnetTokens(revnetTokenLiquidityRatio * revnetTokensReceived);
      traders.push(t);
      dailyPurchases.push({ ethSpent, revnetTokensReceived, source });
    }

    // Make sales
    let dailySales = [];
    traders.forEach((t) => {
      if (t.sale) return;
      if (Math.random() < saleProbability) {
        let revnetTokensSpent =
          t.purchase.revnetTokensReceived * (1 - revnetTokenLiquidityRatio);
        let { ethReceived, source } = sellRevnetTokens(
          revnetTokensSpent,
          r,
          p,
          t
        );
        t.recordSale(revnetTokensSpent, ethReceived, source, r.day);
        p.provideEth(ethLiquidityRatio * ethReceived);
        dailySales.push({ revnetTokensSpent, ethReceived, source });
      }
    });

    // Record results
    simulationResults.push({
      day: r.day,
      ethBalance: r.ethBalance,
      tokenSupply: r.tokenSupply,
      priceCeiling: r.getPriceCeiling(),
      priceFloor:
        r.tokenSupply > 1
          ? r.getEthReclaimAmount(1)
          : r.getEthReclaimAmount(r.tokenSupply),
      tokensSentToBoost: r.tokensSentToBoost,
      poolEthBalance: p.eth,
      poolRevnetTokenBalance: p.revnetToken,
      poolRevnetTokenPrice: p.getMarginalPriceOfRevnetToken(),
      dailyPurchases,
      dailySales,
    });
  }

  return [simulationResults, traders];
}

/*
 * TODO:
 * Make LP more realistic. Make traders "intelligent".
 * Plot traders and trades
 * Descriptions for parameters
 * Double check price floor logic
 */

const solar = {
  base03: "#002b36",
  base02: "#073642",
  base01: "#586e75",
  base00: "#657b83",
  base0: "#839496",
  base1: "#93a1a1",
  base2: "#eee8d5",
  base3: "#fdf6e3",
  yellow: "#b58900",
  orange: "#cb4b16",
  red: "#dc322f",
  magenta: "#d33682",
  violet: "#6c71c4",
  blue: "#268bd2",
  cyan: "#2aa198",
  green: "#859900",
};

const dashboard = document.getElementById("dashboard");
const chartStyles = {
  color: solar.base01,
  backgroundColor: solar.base3,
  fontSize: "16px",
  fontFamily: "'Times New Roman', Times, serif",
  overflow: "visible",
};
function main() {
  console.time("main");
  dashboard.innerHTML = "";

  console.time("simulate");

  let [simulationData, traders] = simulate();
  console.timeEnd("simulate");

  let tokenPricePlot = Plot.plot({
    title: "Revnet Token Price",
    style: chartStyles,
    marginLeft: 0,
    x: { label: "Day", insetLeft: 36 },
    y: { label: "ETH (Ξ)" },
    marks: [
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          py: "poolRevnetTokenPrice",
          stroke: solar.base01,
        })
      ),
      Plot.gridY({
        strokeDasharray: "0.75,2",
        strokeOpacity: 1,
      }),
      Plot.axisY({
        tickSize: 0,
        dx: 38,
        dy: -6,
        lineAnchor: "bottom",
        tickFormat: (d, i, t) => (i === t.length - 1 ? `Ξ ${d}` : d),
      }),
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -17,
          dx: 90,
          frameAnchor: "top-left",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `AMM Price: ${d.poolRevnetTokenPrice.toFixed(2)} Ξ`,
              `Ceiling: ${d.priceCeiling.toFixed(2)} Ξ`,
              `Floor: ${d.priceFloor.toFixed(2)} Ξ`,
            ].join("    "),
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "poolRevnetTokenPrice",
        stroke: solar.blue,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "poolRevnetTokenPrice",
          dx: 3,
          text: () => "AMM Price",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "priceCeiling",
        stroke: solar.green,
        curve: "step-after",
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "priceCeiling",
          dx: 3,
          text: () => "Price Ceiling",
          textAnchor: "start",
          fill: solar.green,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "priceFloor",
        stroke: solar.red,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "priceFloor",
          dx: 3,
          text: () => "Price Floor",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
    ],
  });

  let revnetPlot = Plot.plot({
    title: "Revnet Balances",
    style: chartStyles,
    x: { label: "Day" },
    y: { label: "Amount", grid: true },
    marks: [
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `Token Supply: ${d.tokenSupply.toFixed(2)}`,
              `ETH Balance: ${d.ethBalance.toFixed(2)} Ξ`,
            ].join("     "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "tokenSupply",
        stroke: solar.red,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "tokenSupply",
          dx: 3,
          text: () => "Token Supply",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "ethBalance",
        stroke: solar.blue,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "ethBalance",
          dx: 3,
          text: () => "ETH Balance",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
    ],
  });

  let liquidityPoolPlot = Plot.plot({
    title: "Liquidity Pool Balances",
    style: chartStyles,
    x: { label: "Day" },
    y: { label: "Amount", grid: true },
    marks: [
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `Token Liquidity: ${d.poolRevnetTokenBalance.toFixed(2)}`,
              `ETH Liquidity: ${d.poolEthBalance.toFixed(2)} Ξ`,
            ].join("    "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "poolRevnetTokenBalance",
        stroke: solar.red,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "poolRevnetTokenBalance",
          dx: 3,
          text: () => "Token Liquidity",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "poolEthBalance",
        stroke: solar.blue,
      }),
      Plot.text(
        simulationData,
        Plot.selectLast({
          x: "day",
          y: "poolEthBalance",
          dx: 3,
          text: () => "ETH Liquidity",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
    ],
  });

  let boostPlot = Plot.plot({
    title: "Cumulative Tokens Sent to Boost",
    style: chartStyles,
    x: { label: "Day" },
    y: { label: "Tokens", grid: true },
    marks: [
      Plot.text(
        simulationData,
        Plot.pointerX({
          px: "day",
          py: "tokensSentToBoost",
          dy: -18,
          frameAnchor: "top-right",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `Tokens sent: ${d.tokensSentToBoost.toFixed(2)}`,
            ].join("    "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        simulationData,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(simulationData, {
        x: "day",
        y: "tokensSentToBoost",
        stroke: solar.red,
      }),
    ],
  });

  const purchases = simulationData.flatMap((v) =>
    v.dailyPurchases.map((p) => {
      return { day: v.day, ...p };
    })
  );

  const sales = simulationData.flatMap((v) =>
    v.dailySales.map((s) => {
      return { day: v.day, ...s };
    })
  );

  let cumulativeTrades = [];
  let purchasesCopy = purchases.slice();
  let salesCopy = sales.slice();
  for (let i = 0; i < simulationData.length; i++) {
    let { ethSpent, revnetTokensReceived, revnetTokensSpent, ethReceived } =
      i === 0
        ? {
            ethSpent: 0,
            revnetTokensReceived: 0,
            revnetTokensSpent: 0,
            ethReceived: 0,
          }
        : cumulativeTrades[i - 1];

    while (purchasesCopy[0]?.day === i) {
      let purchaseToAdd = purchasesCopy.shift();
      ethSpent += purchaseToAdd.ethSpent;
      revnetTokensReceived += purchaseToAdd.revnetTokensReceived;
    }

    while (salesCopy[0]?.day === i) {
      let saleToAdd = salesCopy.shift();
      revnetTokensSpent += saleToAdd.revnetTokensSpent;
      ethReceived += saleToAdd.ethReceived;
    }

    cumulativeTrades.push({
      day: i,
      ethSpent,
      revnetTokensReceived,
      revnetTokensSpent,
      ethReceived,
    });
  }

  let cumulativeVolumesPlot = Plot.plot({
    title: "Cumulative Volumes (Revnet and Pool)",
    style: chartStyles,
    x: { label: "Day" },
    y: { label: "Amount", grid: true },
    marks: [
      Plot.text(
        cumulativeTrades,
        Plot.pointerX({
          px: "day",
          dy: -18,
          dx: 45,
          frameAnchor: "top-left",
          text: (d) =>
            [
              `Day: ${d.day}`,
              `ETH Spent: ${d.ethSpent.toFixed(2)} Ξ`,
              `Tokens Received: ${d.revnetTokensReceived.toFixed(2)}`,
              `Tokens Spent: ${d.revnetTokensSpent.toFixed(2)}`,
              `ETH Recieved: ${d.ethReceived.toFixed(2)} Ξ`,
            ].join("   "),
        })
      ),
      Plot.ruleY([0]),
      Plot.ruleX(
        cumulativeTrades,
        Plot.pointerX({
          x: "day",
          stroke: solar.base01,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "ethSpent",
        stroke: solar.blue,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "ethSpent",
          dx: 3,
          text: () => "ETH Spent",
          textAnchor: "start",
          fill: solar.blue,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "revnetTokensReceived",
        stroke: solar.red,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "revnetTokensReceived",
          dx: 3,
          text: () => "Tokens Purchased",
          textAnchor: "start",
          fill: solar.red,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "revnetTokensSpent",
        stroke: solar.green,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "revnetTokensSpent",
          dx: 3,
          text: () => "Tokens Sold",
          textAnchor: "start",
          fill: solar.green,
        })
      ),
      Plot.line(cumulativeTrades, {
        x: "day",
        y: "ethReceived",
        stroke: solar.cyan,
      }),
      Plot.text(
        cumulativeTrades,
        Plot.selectLast({
          x: "day",
          y: "ethReceived",
          dx: 3,
          text: () => "ETH Received From Sales",
          textAnchor: "start",
          fill: solar.cyan,
        })
      ),
    ],
  });
  
  const purchaseData = traders.filter(t => t.purchase).map(t => t.purchase)

  
  const purchasePlot = Plot.plot({
    title: "Purchases",
    style: chartStyles,
    grid: true,
    x: { label: "Day" },
    y: { label: "Purchase Amount (ETH)" },
    symbol: { label: "Source", legend: true, style: { background: "none", fontSize: "18px"} },
    color: { range: [solar.cyan, solar.magenta] },
    marks: [
      Plot.ruleY([0]),
      Plot.dot(purchaseData, {
        x: "day",
        y: "ethSpent",
        symbol: "source",
        stroke: "source",
        tip: true,
      })
    ]
  })

  const saleData = traders
    .filter((t) => t.sale)
    .map((t) => ({
      saleDay: t.sale.day,
      saleSource: t.sale.source,
      purchaseDay: t.purchase.day,
      purchaseSource: t.purchase.source,
      daysHeld: t.sale.day - t.purchase.day,
      profit: t.sale.ethReceived - t.purchase.ethSpent,
      tokensPurchased: t.purchase.revnetTokensReceived,
    }));

  const salePlot = Plot.plot({
    title: "Sales",
    style: chartStyles,
    grid: true,
    x: {label: "Day"},
    y: {label: "Tokens Sold"},
    symbol: { label: "Source", legend: true, style: { background: "none", fontSize: "18px"} },
    color: { range: [solar.cyan, solar.magenta]},
    marks: [
      Plot.ruleY([0]),
      Plot.dot(saleData, {
        x: "saleDay",
        y: "tokensPurchased",
        symbol: "saleSource",
        stroke: "saleSource",
        tip: true,
      })
    ]
  })

  const profitabilityPlot = Plot.plot({
    title: "Profitability",
    style: chartStyles,
    grid: true,
    color: {
      scheme: "Warm",
      legend: true,
      label: "Day Purchased",
      style: { background: "none" },
    },
    r: { label: "Tokens Purchased" },
    x: { label: "Days Held" },
    y: { label: "Profit (ETH)" },
    marks: [
      Plot.dot(saleData, {
        x: "daysHeld",
        y: "profit",
        r: "tokensPurchased",
        fill: "purchaseDay",
        tip: true,
      }),
    ],
  });

  dashboard.appendChild(tokenPricePlot);
  dashboard.appendChild(revnetPlot);
  dashboard.appendChild(liquidityPoolPlot);
  dashboard.appendChild(boostPlot);
  dashboard.appendChild(cumulativeVolumesPlot);
  dashboard.appendChild(profitabilityPlot);
  dashboard.appendChild(purchasePlot)
  dashboard.appendChild(salePlot)
  console.timeEnd("main");
}

main();

document.getElementById("simulate").addEventListener("click", main);

// Automatically update simulation on input
let timeoutId;
const inputs = document.querySelectorAll("input");
inputs.forEach((input) => {
  input.addEventListener("input", () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(main, 100);
  });
});
