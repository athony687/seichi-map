import { APIProvider, Map } from '@vis.gl/react-google-maps'

const OSAKA = { lat: 34.6937, lng: 135.5023 }

function App() {
  return (
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <Map
        style={{ width: '100vw', height: '100vh' }}
        defaultCenter={OSAKA}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI={false}
      />
    </APIProvider>
  )
}

export default App
