import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * LocationAutocomplete — Reusable autocomplete input for Indian locations.
 *
 * Props:
 *   value       — current text value
 *   onChange     — (value: string) => void  — called on text change
 *   onSelect    — ({ name, lat, lon }) => void — called when a location is selected
 *   placeholder — input placeholder text
 *   className   — optional className for the outer wrapper
 *   inputClass  — optional className for the <input> element
 *   autoFocus   — boolean, whether to autofocus the input
 *   id          — optional id for the input
 *   darkMode    — boolean (default true), style variant
 *   inline      — boolean, for inline/chatbot usage (compact style)
 */
export default function LocationAutocomplete({
    value = '',
    onChange,
    onSelect,
    placeholder = 'Search location...',
    className = '',
    inputClass = '',
    autoFocus = false,
    id,
    darkMode = true,
    inline = false,
}) {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [noResults, setNoResults] = useState(false);
    const [error, setError] = useState(false);
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        function onClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const fetchLocations = useCallback(async (query) => {
        if (!query || query.trim().length < 3) {
            setResults([]);
            setOpen(false);
            setNoResults(false);
            setError(false);
            return;
        }

        setLoading(true);
        setError(false);
        setNoResults(false);

        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&countrycodes=in&format=json&limit=5&accept-language=en`;
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'Sawaari-App/1.0' },
            });

            if (!resp.ok) throw new Error('Nominatim request failed');

            const data = await resp.json();
            setResults(data);
            setOpen(true);
            setNoResults(data.length === 0);
        } catch (err) {
            console.warn('Location search failed:', err);
            setResults([]);
            setOpen(false);
            setError(true);
            // Allow manual text entry as fallback — do nothing special
        } finally {
            setLoading(false);
        }
    }, []);

    function handleInputChange(e) {
        const val = e.target.value;
        onChange?.(val);

        // Debounce the API call by 300ms
        clearTimeout(debounceRef.current);
        if (val.trim().length >= 3) {
            debounceRef.current = setTimeout(() => fetchLocations(val), 300);
        } else {
            setResults([]);
            setOpen(false);
            setNoResults(false);
        }
    }

    function handleSelect(item) {
        // Extract a shorter display name (first 2-3 parts of display_name)
        const parts = item.display_name.split(', ');
        const shortName = parts.slice(0, 3).join(', ');

        onChange?.(shortName);
        onSelect?.({
            name: shortName,
            fullName: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
        });
        setOpen(false);
        setResults([]);
    }

    function handleFocus() {
        if (results.length > 0) setOpen(true);
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            setOpen(false);
        }
    }

    // Truncate display name for dropdown items
    function formatDisplayName(name) {
        const parts = name.split(', ');
        if (parts.length <= 3) return name;
        return parts.slice(0, 3).join(', ') + ', ' + parts[parts.length - 1];
    }

    return (
        <div ref={wrapperRef} className={`relative ${className}`} style={inline ? { position: 'relative' } : undefined}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    id={id}
                    className={inputClass || 'input-field'}
                    autoComplete="off"
                />
                {/* Loading spinner */}
                {loading && (
                    <div style={{
                        position: 'absolute',
                        right: inline ? 6 : 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: inline ? 14 : 18,
                        height: inline ? 14 : 18,
                    }}>
                        <svg
                            viewBox="0 0 24 24"
                            style={{
                                width: '100%',
                                height: '100%',
                                animation: 'spin 0.8s linear infinite',
                            }}
                        >
                            <circle
                                cx="12" cy="12" r="10"
                                stroke="rgba(139, 92, 246, 0.3)"
                                strokeWidth="3"
                                fill="none"
                            />
                            <path
                                d="M12 2 a10 10 0 0 1 10 10"
                                stroke="#8b5cf6"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                )}
                {/* Location pin icon when not loading */}
                {!loading && value.length > 0 && (
                    <div style={{
                        position: 'absolute',
                        right: inline ? 6 : 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: inline ? 12 : 14,
                        opacity: 0.4,
                    }}>📍</div>
                )}
            </div>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    marginTop: 4,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: darkMode
                        ? 'linear-gradient(180deg, #1e1530, #15101f)'
                        : '#fff',
                    border: darkMode
                        ? '1px solid rgba(139, 92, 246, 0.25)'
                        : '1px solid #e5e7eb',
                    boxShadow: darkMode
                        ? '0 12px 40px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.1)'
                        : '0 8px 24px rgba(0,0,0,0.12)',
                    maxHeight: 220,
                    overflowY: 'auto',
                }}>
                    {noResults ? (
                        <div style={{
                            padding: '12px 14px',
                            color: darkMode ? 'rgba(255,255,255,0.4)' : '#6b7280',
                            fontSize: 12,
                            textAlign: 'center',
                        }}>
                            No locations found — try different keywords
                        </div>
                    ) : (
                        results.map((item, i) => (
                            <button
                                key={item.place_id || i}
                                type="button"
                                onClick={() => handleSelect(item)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 10,
                                    width: '100%',
                                    padding: '10px 14px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: i < results.length - 1
                                        ? (darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f3f4f6')
                                        : 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 0.15s',
                                    color: darkMode ? '#fff' : '#111',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(139,92,246,0.12)' : '#f9fafb'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{
                                    fontSize: 16,
                                    marginTop: 1,
                                    flexShrink: 0,
                                    opacity: 0.7,
                                }}>📍</span>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        color: darkMode ? '#fff' : '#111',
                                    }}>
                                        {item.display_name.split(', ')[0]}
                                    </div>
                                    <div style={{
                                        fontSize: 11,
                                        color: darkMode ? 'rgba(255,255,255,0.4)' : '#9ca3af',
                                        marginTop: 1,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>
                                        {formatDisplayName(item.display_name)}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}

            {/* Error fallback note */}
            {error && (
                <div style={{
                    fontSize: 10,
                    color: darkMode ? 'rgba(255,255,255,0.3)' : '#9ca3af',
                    marginTop: 2,
                    paddingLeft: 2,
                }}>
                    Location search unavailable — type manually
                </div>
            )}

            {/* Spinner keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
