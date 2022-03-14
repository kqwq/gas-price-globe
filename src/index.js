import { fetchLiveData, createGlobe, updateCountryTooltips, createDropdowns, updateLeaderboard } from "./globe"
import './main.css'

const init = async() => {
  await fetchLiveData() // Wait for data to be fetched before starting
  createDropdowns()
  updateCountryTooltips()
  updateLeaderboard()
  createGlobe()
}
init()
