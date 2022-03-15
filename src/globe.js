import Globe from 'globe.gl'
import countryData from './data/countries.json'
//import priceData from './data/prices.json'
//import exchangeRate from './data/exchangeRate.json'
//import volumeConversion from './data/volumeConversion.json'
import { scaleSequential } from 'd3-scale'
import { interpolateYlOrRd } from 'd3-scale-chromatic'

let priceData, exchangeRate, volumeConversion

let myGlobe;
let selectedCurrency = 'USD'
let selectedVolume = 'Litre'
let isLogMode = false

const colorScale = scaleSequential(interpolateYlOrRd)
colorScale.domain([0, 1])

const fetchLiveData = async() => {
  let baseUrl = `http://api.2727.ga:8005/api/v1/gas`
  let backupUrl = `https://cdn.jsdelivr.net/gh/kqwq/gas-price-globe/src/data`

  let failed = false
  let testRes;
  try {
    testRes = await fetch(`${baseUrl}/isOnline.txt`)
    if (testRes.ok) {
      console.log('Using live data')
    } else {
      failed = true
    }
  } catch {
    failed = true
  }
  if (failed) {
    console.log('Using backup data')
    baseUrl = backupUrl
  }

  let res = await fetch(`${baseUrl}/price.json`)
  let json = await res.json()
  priceData = json

  res = await fetch(`${baseUrl}/exchangeRate.json`)
  json = await res.json()
  exchangeRate = json

  res = await fetch(`${baseUrl}/volumeConversion.json`)
  json = await res.json()
  volumeConversion = json
}

let countryTooltips = {}
const updateCountryTooltips = () => {
  console.log(selectedCurrency, selectedVolume)
  let lowestQ = Infinity
  let highestQ = -Infinity
  countryData.features.forEach(feature => {
    let d = feature.properties
    let iso2 = d.ISO_A2
    let currencySymbol = exchangeRate.symbols[selectedCurrency]
    let priceDollarPerLiter = priceData[iso2]?.price
    let priceConverted = null
    let logQ = null
    let gasText = ''
    if (priceDollarPerLiter === undefined) {
      gasText = 'No data'
    } else {
      let exchangeConverted = 1 * exchangeRate.rates[selectedCurrency]
      let volumeConverted = 1 * volumeConversion[selectedVolume]
      priceConverted = priceDollarPerLiter * exchangeConverted / volumeConverted
      logQ = isLogMode ? Math.log(priceConverted) : priceConverted
      lowestQ = Math.min(lowestQ, logQ)
      highestQ = Math.max(highestQ, logQ)
      gasText = `${currencySymbol}${parseFloat(priceConverted.toPrecision(3))} / ${selectedVolume.toLocaleLowerCase()}`
    }
    countryTooltips[iso2] = {
      priceConverted: priceConverted,
      logQ: logQ,
      label: `
        <b>${d.ADMIN} (${iso2})</b> <br />
        Gas price: <i>${gasText}</i>
      `,
      
    }
  })
  let rangeQ = highestQ - lowestQ
  countryData.features.forEach(feature => {
    let iso2 = feature.properties.ISO_A2
    let ctt = countryTooltips[iso2]
    let priceConverted = ctt.priceConverted
    if (priceConverted == null) {
      ctt.color = 'rgba(127, 127, 127, 0.8)'
      return
    }
    // logQ is on a logarithmic scale from 0 (min) to 1 (max)
    let q = (ctt.logQ - lowestQ) / rangeQ
    ctt.color = colorScale(q)
  })
}

const createDropdowns = () => {
  // Get parent element
  let parentElement = document.getElementById('dropdowns')

  // Currency dropdown
  let select = document.createElement('select')
  select.id = 'currency'
  select.onchange = () => {
    selectedCurrency = select.value
    updateCountryTooltips()
    updateLeaderboard()
  }
  Object.keys(exchangeRate.symbols).forEach(symbol => {
    let option = document.createElement('option')
    option.value = symbol
    option.innerText = `${symbol} (${exchangeRate.symbols[symbol]})`
    select.appendChild(option)
  })
  parentElement.appendChild(select)

  // Volume dropdown
  let select2 = document.createElement('select')
  select2.id = 'volume'
  select2.onchange = () => {
    selectedVolume = select2.value
    updateCountryTooltips()
    updateLeaderboard()
  }
  Object.keys(volumeConversion).forEach(unit => {
    let option = document.createElement('option')
    option.value = unit
    option.innerText = unit
    select2.appendChild(option)
  })
  parentElement.appendChild(select2)

  // Is logarithmic?
  let select3 = document.createElement('select')
  select3.id = 'log'
  select3.onchange = () => {
    isLogMode = select3.value === 'true'
    updateCountryTooltips()
  }
  let optionLinear = document.createElement('option')
  optionLinear.value = 'false'
  optionLinear.innerText = 'Linear'
  select3.appendChild(optionLinear)
  let optionLog = document.createElement('option')
  optionLog.value = 'true'
  optionLog.innerText = 'Logarithmic'
  select3.appendChild(optionLog)
  parentElement.appendChild(select3)
}

const updateLeaderboard = () => {
  let parentElement = document.getElementById('leaderboard')
  // empty the parent element
  while (parentElement.firstChild) {
    parentElement.removeChild(parentElement.firstChild)
  }
  let countries = Object.values(countryTooltips).filter(a => a.priceConverted != null)
  let mostExpensive5 = countries.sort((a, b) => b.priceConverted - a.priceConverted).slice(0, 5)
  let leastExpensive5 = countries.sort((a, b) => a.priceConverted - b.priceConverted).slice(0, 5)
  let mostExpensive = mostExpensive5.map((ctt, i) => `<b>${i + 1}.</b> ${ctt.label}`).join('<br />')
  let leastExpensive = leastExpensive5.map((ctt, i) => `<b>${i + 1}.</b> ${ctt.label}`).join('<br />')
  parentElement.innerHTML = `
    <div class='leaderboard'>
      <div class='leaderboard-title'>Most expensive</div>
      <div class='leaderboard-content'>${mostExpensive}</div>
    </div>
    <div class='leaderboard'>
      <div class='leaderboard-title'>Least expensive</div>
      <div class='leaderboard-content'>${leastExpensive}</div>
    </div>
  `
}



const createGlobe = () => {
  const globeElement = document.getElementById('globe')

  window.addEventListener('resize', (event) => {
    myGlobe.width([event.target.innerWidth])
    myGlobe.height([event.target.innerHeight])
  });
  

  


 // const myImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Solarsystemscope_texture_2k_earth_daymap.jpg';//'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/BlackMarble20161km.jpg/2200px-BlackMarble20161km.jpg'


  myGlobe = Globe();
  myGlobe(globeElement) 
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
  .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
  
    .lineHoverPrecision(0)
    .polygonAltitude(0.01)

    
    .polygonCapColor(({ properties: d }) => countryTooltips[d.ISO_A2].color)
    .polygonSideColor(() => 'rgba(0, 100, 0, 0.18)')
    .polygonStrokeColor(() => '#111')
    .polygonsData(countryData.features.filter(d => d.properties.ISO_A2 !== 'AQ'))

    .polygonLabel(({ properties: d }) => `<div class='tooltip'>${countryTooltips[d.ISO_A2].label}</div>`)
    .onPolygonHover(hoverD => myGlobe
      .polygonAltitude(d => d === hoverD ? 0.06 : 0.01)
      .polygonCapColor(d => d === hoverD ? 'steelblue' : countryTooltips[d.properties.ISO_A2].color)
    )
    .polygonsTransitionDuration(300)
  


  return myGlobe
}

export { fetchLiveData, createGlobe, updateCountryTooltips, createDropdowns, updateLeaderboard }