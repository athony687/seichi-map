import { APIProvider, Map } from '@vis.gl/react-google-maps'

const TOKYO = { lat: 35.6762, lng: 139.6503 }

function App() {
  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <Map
        style={{ width: '100vw', height: '100vh' }}
        defaultCenter={TOKYO}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
      />
    </APIProvider>
  )
}

export default App
