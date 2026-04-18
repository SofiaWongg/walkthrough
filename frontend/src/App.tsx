import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import WalkthroughPage from './pages/WalkthroughPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/properties" replace />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:propertyId" element={<PropertyDetailPage />} />
        <Route path="/walkthroughs/:walkthroughId" element={<WalkthroughPage />} />
      </Routes>
    </BrowserRouter>
  );
}
