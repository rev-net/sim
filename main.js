import './style.css'
import * as d3 from "d3"

const html = String.raw

document.querySelector('#app').innerHTML = html`<h1>Interactive Revnet</h1>
<div id="visualization"></div>
<div>
  <label for="priceCeilingCurve">Price Ceiling Curve:</label>
  <input type="range" id="priceCeilingCurve" name="priceCeilingCurve" min="0" max="1" step="0.01" value="0.05" oninput="document.getElementById('ceilingValue').textContent = Math.round(this.value * 100) + '%'">
  <span id="ceilingValue">5%</span>
</div>
<div>
  <label for="priceFloorCurve">Price Floor Curve:</label>
  <input type="range" id="priceFloorCurve" name="priceFloorCurve" min="0" max="1" step="0.01" value="0.33" oninput="document.getElementById('floorValue').textContent = Math.round(this.value * 100) + '%'">
  <span id="floorValue">33%</span>
</div>
<button id="test">Test</button>
`

const MAX_GENERATIONS = 50

// Declare the chart dimensions and margins.
const width = 800;
const height = 600;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 30;
const marginLeft = 40;

// Declare the x (horizontal position) scale.
const x = d3.scaleLinear()
  .domain([1, MAX_GENERATIONS])
  .range([marginLeft, width - marginRight]);

// Declare the y (vertical position) scale.
const y = d3.scaleLinear()
  .domain([0, 100])
  .range([height - marginBottom, marginTop]);

// Create the SVG container.
const svg = d3.select("#visualization")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Add the x-axis.
svg.append("g")
  .attr("transform", `translate(0,${height - marginBottom})`)
  .call(d3.axisBottom(x));
svg.append("text")
  .attr("transform", `translate(${width / 2}, ${height})`) // Position at the middle of the x-axis
  .style("text-anchor", "middle") // Center the text
  .text("Generation Number");

// Add the y-axis.
svg.append("g")
  .attr("transform", `translate(${marginLeft},0)`)
  .call(d3.axisLeft(y));
svg.append("text")
  .attr("transform", "rotate(-90)") // Rotate the text
  .attr("y", 0 - marginLeft) // Position at the left of the y-axis
  .attr("x", 0 - (height / 2)) // Position at the middle of the y-axis
  .attr("dy", "1em") // Adjust the position a bit
  .style("text-anchor", "middle") // Center the text
  .text("ETH Price per Token");

// Add the price ceiling
let priceCeilingPath = svg.append("path")
  .attr("fill", "none")
  .attr("stroke", "steelblue")
  .attr("stroke-width", 1.5)
let priceCeilingLine = d3.line()
  .x(d => x(d.generation))
  .y(d => y(d.price))

function updatePriceCeiling() {
  const priceCeilingCurve = document.getElementById("priceCeilingCurve").value
  const priceCeiling = (generationNumber) => 1 / Math.pow((1 - priceCeilingCurve), (generationNumber - 1))
  let priceCeilingData = [];
  for (let i = 1; i < MAX_GENERATIONS; i++)
    priceCeilingData.push({ generation: i, price: priceCeiling(i) })

  priceCeilingPath.datum(priceCeilingData).attr("d", priceCeilingLine)
}
updatePriceCeiling()

// Add the price floor
let priceFloorPath = svg.append("path")
  .attr("fill", "none")
.attr("stroke", "red")
.attr("stroke-width", 1.5)
let priceFloorLine = d3.line()
  .x(d => x(d.generation))
  .y(d => y(d.price))

function updatePriceFloor() {
  const priceFloorCurve = document.getElementById("priceFloorCurve").value
  const priceFloor = (tokensBeingDestroyed, revnetTokenSupply, revnetEthSupply) => (revnetEthSupply * tokensBeingDestroyed / revnetTokenSupply) * ((1 - priceFloorCurve) + (priceFloorCurve * tokensBeingDestroyed / revnetTokenSupply))
  let priceFloorData = [];
  for(let i = 1; i < MAX_GENERATIONS; i++)
    priceFloorData.push({ generation: i, price: priceFloor(1, 10, i) })
  
  priceFloorPath.datum(priceFloorData).attr("d", priceFloorLine)
}
updatePriceFloor()

document.querySelector("#test").onclick = () => updatePriceFloor()

document.querySelector("#priceCeilingCurve").addEventListener("input", updatePriceCeiling)
document.querySelector("#priceFloorCurve").addEventListener("input", updatePriceFloor)