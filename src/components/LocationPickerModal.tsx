import React, { useState } from 'react';
import { MapPin, X, Navigation, Search, Check, Globe, Compass } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import type { JournalLocation } from '../types';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation?: JournalLocation;
  onSelectLocation: (loc: JournalLocation | undefined) => void;
}

const PRESET_PLACES: Array<{ name: string; address: string; lat: number; lng: number; icon: string }> = [
  { name: 'Kyoto Zen Temple & Bamboo Forest', address: 'Arashiyama, Ukyo Ward, Kyoto, Japan', lat: 35.0170, lng: 135.6713, icon: '🎋' },
  { name: 'Central Park Sheep Meadow', address: 'New York, NY 10024, USA', lat: 40.7711, lng: -73.9742, icon: '🌳' },
  { name: 'Big Sur Coastal Bluffs', address: 'Highway 1, Big Sur, California, USA', lat: 36.2704, lng: -121.8081, icon: '🌊' },
  { name: 'Alpine Solitude Cabin', address: 'Zermatt, Valais, Switzerland', lat: 45.9765, lng: 7.7491, icon: '🏔️' },
  { name: 'University Reading Rotunda', address: 'Oxford OX1 3BG, United Kingdom', lat: 51.7537, lng: -1.2544, icon: '📚' },
  { name: 'Home Sanctuary & Workspace', address: 'Personal Reflection Sanctuary', lat: 37.7749, lng: -122.4194, icon: '🏡' },
];

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<JournalLocation | undefined>(currentLocation);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  if (!isOpen) return null;

  const handleUseCurrentPosition = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetecting(false);
        const loc: JournalLocation = {
          name: 'Current Presence Location',
          address: `Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setSelectedPlace(loc);
      },
      () => {
        setIsDetecting(false);
        // Default to a serene fallback location
        const loc: JournalLocation = {
          name: 'Mindful Sanctuary',
          address: 'Peaceful Ambient Environment',
          lat: 37.7749,
          lng: -122.4194,
        };
        setSelectedPlace(loc);
      },
      { timeout: 8000 }
    );
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const loc: JournalLocation = {
      name: customName.trim(),
      address: customAddress.trim() || undefined,
      lat: selectedPlace?.lat || 37.7749,
      lng: selectedPlace?.lng || -122.4194,
    };
    setSelectedPlace(loc);
    setCustomName('');
    setCustomAddress('');
  };

  const filteredPresets = PRESET_PLACES.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      id="location-picker-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="location-picker-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Pin Location to Entry
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Google Maps Platform
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Ground your reflections in your physical environment. Gemini adapts with spatial awareness.
              </p>
            </div>
          </div>
          <button
            id="close-location-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Active selection banner */}
          {selectedPlace ? (
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-300 flex items-center justify-center text-base">
                  📍
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-100">{selectedPlace.name}</div>
                  {selectedPlace.address && (
                    <div className="text-xs text-slate-400">{selectedPlace.address}</div>
                  )}
                  <div className="text-[10px] text-indigo-400/80 font-mono mt-0.5">
                    Lat: {selectedPlace.lat.toFixed(4)}, Lng: {selectedPlace.lng.toFixed(4)}
                  </div>
                </div>
              </div>
              <button
                id="remove-selected-location-btn"
                onClick={() => setSelectedPlace(undefined)}
                className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 transition-colors"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>No location currently attached to this entry.</span>
              <button
                id="detect-gps-btn"
                onClick={handleUseCurrentPosition}
                disabled={isDetecting}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 transition-all font-medium"
              >
                <Navigation className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Detecting...' : 'Use Current GPS'}</span>
              </button>
            </div>
          )}

          {/* Interactive Map Visualizer / Viewport */}
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-52 relative">
            {mapsApiKey ? (
              <APIProvider apiKey={mapsApiKey}>
                <Map
                  style={{ width: '100%', height: '100%' }}
                  defaultCenter={{
                    lat: selectedPlace?.lat || 37.7749,
                    lng: selectedPlace?.lng || -122.4194,
                  }}
                  defaultZoom={selectedPlace ? 13 : 4}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  {selectedPlace && (
                    <AdvancedMarker
                      position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                      title={selectedPlace.name}
                    />
                  )}
                </Map>
              </APIProvider>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-radial from-slate-900 to-slate-950">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2.5">
                  <Compass className="w-6 h-6 animate-pulse" />
                </div>
                <p className="text-xs font-medium text-slate-200">
                  {selectedPlace ? selectedPlace.name : 'Interactive Coordinates Canvas'}
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                  {selectedPlace
                    ? `Pinned: ${selectedPlace.lat.toFixed(4)}° N, ${selectedPlace.lng.toFixed(4)}° W`
                    : 'Select a serene preset or enter your custom location below to attach geographic context.'}
                </p>
                <div className="mt-2.5 text-[10px] text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-500/30">
                  Attribution: gmp_mcp_codeassist_v1_aistudio • Modern GMP Standard
                </div>
              </div>
            )}
          </div>

          {/* Search Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Serene Atmospheric Presets
              </label>
              <span className="text-[11px] text-slate-500">Pick to pin instantly</span>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                id="search-preset-places-input"
                type="text"
                placeholder="Search inspiring environments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredPresets.map((preset) => {
                const isSelected = selectedPlace?.name === preset.name;
                return (
                  <button
                    key={preset.name}
                    id={`preset-place-${preset.name.replace(/\s+/g, '-').toLowerCase()}`}
                    type="button"
                    onClick={() =>
                      setSelectedPlace({
                        name: preset.name,
                        address: preset.address,
                        lat: preset.lat,
                        lng: preset.lng,
                      })
                    }
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-start space-x-2.5 ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-lg leading-none mt-0.5">{preset.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{preset.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{preset.address}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Location Entry */}
          <div className="border-t border-slate-800 pt-4">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Custom Location or Address
            </label>
            <form onSubmit={handleAddCustom} className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  id="custom-place-name-input"
                  type="text"
                  placeholder="Location Name (e.g., Lakeside Bench)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                />
                <input
                  id="custom-place-address-input"
                  type="text"
                  placeholder="Address or City (e.g., Lake Tahoe, CA)"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  className="px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                />
              </div>
              <button
                id="apply-custom-location-btn"
                type="submit"
                disabled={!customName.trim()}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-xl text-xs font-medium text-slate-200 transition-colors"
              >
                Attach Custom Location
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            id="cancel-location-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            id="save-location-btn"
            type="button"
            onClick={() => {
              onSelectLocation(selectedPlace);
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-xs font-medium text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center space-x-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Location to Entry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
