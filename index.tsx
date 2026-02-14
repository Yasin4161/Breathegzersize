
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from '@google/genai'; 

// --- Types & Data ---

type BreathPhase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

interface BreathProfile {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    color: string;
    secondaryColor: string;
    accentColor: string; // For 2D shading
    pattern: {
        inhale: number;
        holdIn: number;
        exhale: number;
        holdOut: number;
    };
}

const PROFILES: BreathProfile[] = [
    {
        id: 'sleep',
        title: 'Derin Uyku',
        subtitle: '4-7-8 Protokolü',
        description: 'Vücudu "kapatma" komutu. NASA astronotlarının uyku öncesi rutini. Uykusuzluk tarihe karışacak.',
        color: '#4338ca', // Indigo 700
        secondaryColor: '#6366f1', // Indigo 500
        accentColor: '#312e81', // Indigo 900
        pattern: { inhale: 4000, holdIn: 7000, exhale: 8000, holdOut: 0 },
    },
    {
        id: 'focus',
        title: 'Navy SEALs',
        subtitle: 'Kutu Nefesi',
        description: 'Elit askerlerin çatışma anında nabzını düşürmek ve %100 odaklanmak için kullandığı gizli silah.',
        color: '#0284c7', // Sky 600
        secondaryColor: '#38bdf8', // Sky 400
        accentColor: '#0c4a6e', // Sky 900
        pattern: { inhale: 4000, holdIn: 4000, exhale: 4000, holdOut: 4000 },
    },
    {
        id: 'voltage',
        title: 'Yüksek Voltaj',
        subtitle: '6-2 Güç Döngüsü',
        description: 'Kafeinsiz enerji patlaması. Hızlı boşaltım ve derin dolum ile sinir sistemini elektriklendir.',
        color: '#eab308', // Yellow 600
        secondaryColor: '#facc15', // Yellow 400
        accentColor: '#854d0e', // Yellow 800
        pattern: { inhale: 6000, holdIn: 0, exhale: 2000, holdOut: 0 },
    },
    {
        id: 'panic',
        title: 'Panik Reset',
        subtitle: '7-11 Tekniği',
        description: 'Biyolojik "Acil Durum" butonu. Parasempatik sistemi zorla devreye sokar ve anksiyete krizini saniyeler içinde keser.',
        color: '#be123c', // Rose 700
        secondaryColor: '#f43f5e', // Rose 500
        accentColor: '#881337', // Rose 900
        pattern: { inhale: 7000, holdIn: 0, exhale: 11000, holdOut: 0 },
    },
    {
        id: 'energy',
        title: 'Sabah Ateşi',
        subtitle: 'Hiper Oksijenasyon',
        description: 'Yataktan roket gibi kalk. Kanındaki oksijeni tavan yaptırarak doğal bir espresso etkisi yarat.',
        color: '#d97706', // Amber 600
        secondaryColor: '#fbbf24', // Amber 400
        accentColor: '#78350f', // Amber 900
        pattern: { inhale: 4000, holdIn: 0, exhale: 2000, holdOut: 0 },
    },
    {
        id: 'balance',
        title: 'Kalp Rezonansı',
        subtitle: 'Biyolojik Tutarlılık',
        description: 'Kalp ve beyni aynı frekansa kilitler. Stresi hücresel düzeyde yok eder ve duygusal dengeyi resetler.',
        color: '#059669', // Emerald 600
        secondaryColor: '#34d399', // Emerald 400
        accentColor: '#064e3b', // Emerald 900
        pattern: { inhale: 5500, holdIn: 0, exhale: 5500, holdOut: 0 },
    },
    {
        id: 'recovery',
        title: 'Taktiksel Onarım',
        subtitle: 'Performans Sonrası',
        description: 'Ağır antrenman veya yoğun stres sonrası vücudu anında tamir moduna alır. Sporcuların toparlanma sırrı.',
        color: '#7e22ce', // Purple 700
        secondaryColor: '#a855f7', // Purple 500
        accentColor: '#581c87', // Purple 900
        pattern: { inhale: 4000, holdIn: 2000, exhale: 4000, holdOut: 0 },
    },
    {
        id: 'apnea',
        title: 'CO2 Toleransı',
        subtitle: 'Dalgıç Ciğeri',
        description: 'Akciğer kapasiteni insanüstü seviyeye zorla. Oksijen verimliliğini artırır ve zihinsel dayanıklılığı test eder.',
        color: '#0f172a', // Slate 900
        secondaryColor: '#475569', // Slate 600
        accentColor: '#020617', // Slate 950
        pattern: { inhale: 5000, holdIn: 15000, exhale: 10000, holdOut: 5000 },
    }
];

// --- Audio Engine (Synthesized Wind/Breath) ---

class BreathAudioEngine {
    ctx: AudioContext | null = null;
    noiseNode: AudioBufferSourceNode | null = null;
    gainNode: GainNode | null = null;
    filterNode: BiquadFilterNode | null = null;
    isPlaying: boolean = false;

    constructor() {
        // Initialize on user interaction
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    createNoiseBuffer() {
        if (!this.ctx) return null;
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise loop
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            // Pink noise approximation
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // Compensate for gain loss
        }
        return buffer;
    }

    startNoise() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;

        if (this.isPlaying) return;

        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const buffer = this.createNoiseBuffer();
        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = buffer;
        this.noiseNode.loop = true;

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 200;

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0;

        this.noiseNode.connect(this.filterNode);
        this.filterNode.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);

        this.noiseNode.start();
        this.isPlaying = true;
    }

    stopNoise() {
        if (this.noiseNode) {
            this.noiseNode.stop();
            this.noiseNode.disconnect();
            this.noiseNode = null;
        }
        this.isPlaying = false;
    }

    triggerPhase(phase: BreathPhase, durationMs: number) {
        if (!this.ctx || !this.gainNode || !this.filterNode) return;

        const now = this.ctx.currentTime;
        const duration = durationMs / 1000;

        // Reset any scheduled ramps
        this.gainNode.gain.cancelScheduledValues(now);
        this.filterNode.frequency.cancelScheduledValues(now);

        if (phase === 'inhale') {
            // Volume Up, Freq Up (Wind rushing in)
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(0.8, now + duration);

            this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
            this.filterNode.frequency.exponentialRampToValueAtTime(1200, now + duration);
        } else if (phase === 'exhale') {
            // Volume Down, Freq Down (Wind rushing out)
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(0.0, now + duration);

            this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
            this.filterNode.frequency.exponentialRampToValueAtTime(100, now + duration);
        } else if (phase === 'hold-in') {
             // Slight silence or hum
             this.gainNode.gain.linearRampToValueAtTime(0.1, now + 0.5);
             this.filterNode.frequency.linearRampToValueAtTime(200, now + 0.5);
        } else if (phase === 'hold-out') {
             // Silence
             this.gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        }
    }
}

const audioEngine = new BreathAudioEngine();


// --- Icons ---

const IconPlay = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5V19L19 12L8 5Z" />
    </svg>
);

const IconPause = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" />
    </svg>
);

const IconChevronLeft = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);

// --- Components ---

function App() {
    const [activeProfile, setActiveProfile] = useState<BreathProfile | null>(null);

    return (
        <div style={{ width: '100%', height: '100%', background: '#09090b' }}>
            {activeProfile ? (
                <SessionView 
                    profile={activeProfile} 
                    onExit={() => {
                        audioEngine.stopNoise();
                        setActiveProfile(null);
                    }} 
                />
            ) : (
                <MenuView onSelect={setActiveProfile} />
            )}
        </div>
    );
}

// --- Menu View ---

function formatPattern(pattern: BreathProfile['pattern']): string {
    const parts = [];
    parts.push(`AL: ${pattern.inhale / 1000}sn`);
    if (pattern.holdIn > 0) parts.push(`TUT: ${pattern.holdIn / 1000}sn`);
    parts.push(`VER: ${pattern.exhale / 1000}sn`);
    if (pattern.holdOut > 0) parts.push(`TUT: ${pattern.holdOut / 1000}sn`);
    return parts.join(' • ');
}

function MenuView({ onSelect }: { onSelect: (p: BreathProfile) => void }) {
    return (
        <div className="menu-container">
            <header className="menu-header">
                <span className="logo">AURA.OS</span>
                <h1>MODUNU<br />SEÇ.</h1>
            </header>

            <div className="cards-scroll">
                {PROFILES.map((profile, index) => (
                    <div 
                        key={profile.id} 
                        className="card"
                        onClick={() => onSelect(profile)}
                        style={{ '--delay': `${index * 0.1}s`, '--accent': profile.color } as React.CSSProperties}
                    >
                        <div className="card-bg"></div>
                        <div className="card-content">
                            <div className="card-top">
                                <div className="card-icon" style={{ backgroundColor: profile.color }}></div>
                                <span className="pattern-badge">
                                    {formatPattern(profile.pattern)}
                                </span>
                            </div>
                            <div>
                                <h3>{profile.title}</h3>
                                <span className="subtitle" style={{ color: profile.secondaryColor }}>{profile.subtitle}</span>
                            </div>
                            <p>{profile.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .menu-container {
                    height: 100%;
                    background: #09090b; /* Zinc 950 */
                    color: #fff;
                    display: flex;
                    flex-direction: column;
                    padding: 2rem 1.5rem;
                    overflow-y: auto;
                    font-family: 'Manrope', sans-serif;
                }
                .menu-header {
                    margin-bottom: 2.5rem;
                    animation: fadeIn 0.8s ease-out;
                }
                .logo {
                    font-size: 0.8rem;
                    letter-spacing: 4px;
                    opacity: 0.5;
                    font-weight: 800;
                    display: block;
                    margin-bottom: 1rem;
                    color: #fff;
                }
                h1 {
                    font-size: 3.5rem;
                    font-weight: 900;
                    line-height: 0.95;
                    margin: 0;
                    letter-spacing: -2px;
                    text-transform: uppercase;
                    background: linear-gradient(to bottom right, #fff, #666);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .cards-scroll {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding-bottom: 4rem;
                }
                .card {
                    position: relative;
                    border-radius: 24px;
                    overflow: hidden;
                    cursor: pointer;
                    min-height: 160px;
                    background: #18181b; /* Zinc 900 */
                    border: 1px solid #27272a; /* Zinc 800 */
                    transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
                    animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
                    animation-delay: var(--delay);
                }
                .card:active {
                    transform: scale(0.97);
                    background: #27272a;
                }
                .card-bg {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at 100% 0%, var(--accent), transparent 70%);
                    opacity: 0.2;
                    transition: opacity 0.3s;
                }
                .card:hover .card-bg {
                    opacity: 0.35;
                }
                .card-content {
                    position: relative;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                    z-index: 1;
                }
                .card-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .card-icon {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    box-shadow: 0 0 15px var(--accent);
                }
                .pattern-badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    background: rgba(255,255,255,0.05);
                    padding: 6px 10px;
                    border-radius: 6px;
                    color: #a1a1aa;
                    letter-spacing: 0.5px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .card h3 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                    color: #fff;
                }
                .subtitle {
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    font-weight: 700;
                    display: block;
                    margin-top: 4px;
                    opacity: 0.9;
                }
                .card p {
                    margin: 0.5rem 0 0 0;
                    font-size: 0.95rem;
                    color: #a1a1aa; /* Zinc 400 */
                    line-height: 1.5;
                    font-weight: 500;
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { 
                    from { opacity: 0; transform: translateY(30px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
            `}</style>
        </div>
    );
}

// --- Visual Component (2D Flat Vector Art) ---

const BreathVisual = ({ 
    scale, 
    duration, 
    color, 
    secondary, 
    accent 
}: { 
    scale: number, 
    duration: number, 
    color: string, 
    secondary: string,
    accent: string 
}) => {
    // We create a layered "flower" or "blob" effect using CSS shapes.
    // This simulates 2D vector art with hard shadows.

    const transitionStyle = {
        transition: `transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`,
    };

    return (
        <div className="visual-wrapper">
            {/* Layer 3: Back Shadow (Darkest) */}
            <div 
                className="blob layer-3" 
                style={{
                    ...transitionStyle,
                    transform: `scale(${scale * 1.05}) rotate(${scale * 10}deg)`,
                    backgroundColor: accent,
                }}
            />
            {/* Layer 2: Mid Tone (Secondary) */}
            <div 
                className="blob layer-2" 
                style={{
                    ...transitionStyle,
                    transform: `scale(${scale * 1.02}) rotate(${-scale * 5}deg)`,
                    backgroundColor: secondary,
                }}
            />
            {/* Layer 1: Main Shape (Primary Color) */}
            <div 
                className="blob layer-1" 
                style={{
                    ...transitionStyle,
                    transform: `scale(${scale})`,
                    backgroundColor: color,
                }}
            >
                {/* Optional: Simple shine effect for 2D feel */}
                <div className="shine"></div>
            </div>

            <style>{`
                .visual-wrapper {
                    position: relative;
                    width: 320px;
                    height: 320px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .blob {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
                    will-change: transform;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2); /* Soft shadow for depth */
                }
                .layer-3 {
                    opacity: 0.4;
                    filter: blur(2px);
                }
                .layer-2 {
                    width: 95%;
                    height: 95%;
                }
                .layer-1 {
                    width: 90%;
                    height: 90%;
                    box-shadow: inset 10px 10px 20px rgba(255,255,255,0.1), 
                                inset -10px -10px 20px rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .shine {
                    position: absolute;
                    top: 20%;
                    left: 20%;
                    width: 20%;
                    height: 10%;
                    background: rgba(255,255,255,0.15);
                    border-radius: 50px;
                    transform: rotate(-45deg);
                }
            `}</style>
        </div>
    );
};

// --- Session View ---

function SessionView({ profile, onExit }: { profile: BreathProfile, onExit: () => void }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [phase, setPhase] = useState<BreathPhase>('inhale');
    const [label, setLabel] = useState('Hazır?');
    const [scale, setScale] = useState(0.5); // Start smaller
    const [secondsLeft, setSecondsLeft] = useState(0); // Countdown state
    
    // Logic refs
    const timerRef = useRef<number | null>(null);
    const countdownIntervalRef = useRef<number | null>(null);
    const phaseIndexRef = useRef(0);
    
    // Visual constants
    const MIN_SCALE = 0.6;
    const MAX_SCALE = 1.0;

    useEffect(() => {
        // Initialize Audio context on mount (suspended state usually)
        audioEngine.init();
        return () => {
            clearTimers();
            audioEngine.stopNoise();
        };
    }, []);

    const clearTimers = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };

    const getPhaseDuration = (pIndex: number) => {
        switch (pIndex % 4) {
            case 0: return profile.pattern.inhale;
            case 1: return profile.pattern.holdIn;
            case 2: return profile.pattern.exhale;
            case 3: return profile.pattern.holdOut;
            default: return 0;
        }
    };

    const getPhaseConfig = (pIndex: number) => {
        const step = pIndex % 4;
        switch (step) {
            case 0: return { type: 'inhale', label: 'NEFES AL', targetScale: MAX_SCALE };
            case 1: return { type: 'hold-in', label: 'TUT', targetScale: MAX_SCALE };
            case 2: return { type: 'exhale', label: 'VER', targetScale: MIN_SCALE };
            case 3: return { type: 'hold-out', label: 'TUT', targetScale: MIN_SCALE };
            default: return { type: 'inhale', label: '...', targetScale: MIN_SCALE };
        }
    };

    const startPhase = () => {
        const pIndex = phaseIndexRef.current;
        const duration = getPhaseDuration(pIndex);

        // Skip 0 duration phases
        if (duration <= 0) {
            phaseIndexRef.current = (pIndex + 1) % 4;
            startPhase();
            return;
        }

        const config = getPhaseConfig(pIndex);
        
        // Update State
        setPhase(config.type as BreathPhase);
        setLabel(config.label);
        setScale(config.targetScale);
        setSecondsLeft(Math.ceil(duration / 1000));

        // Audio Trigger
        audioEngine.triggerPhase(config.type as BreathPhase, duration);

        // Countdown Interval
        let remaining = duration;
        const startTime = Date.now();
        
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        
        countdownIntervalRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const left = Math.ceil((duration - elapsed) / 1000);
            if (left >= 0) setSecondsLeft(left);
        }, 100);

        // Next Phase Timer
        timerRef.current = window.setTimeout(() => {
            phaseIndexRef.current = (pIndex + 1) % 4;
            startPhase();
        }, duration);
    };

    const togglePlay = () => {
        if (isPlaying) {
            // Pause
            setIsPlaying(false);
            clearTimers();
            setLabel('DURAKLATILDI');
            audioEngine.stopNoise(); // Stop sound on pause
        } else {
            // Play
            setIsPlaying(true);
            audioEngine.startNoise(); // Enable engine
            startPhase();
        }
    };
    
    const currentDuration = getPhaseDuration(phaseIndexRef.current);

    return (
        <div className="session-container" style={{ background: '#000' }}>
            {/* Header */}
            <div className="session-header">
                <button className="icon-btn" onClick={onExit}>
                    <IconChevronLeft />
                </button>
                <div className="profile-tag">
                    {profile.title}
                </div>
                <div style={{ width: 44 }}></div>
            </div>

            {/* Main Visual Area */}
            <div className="visual-area">
                <div className="visual-stack">
                    <BreathVisual 
                        scale={scale} 
                        duration={currentDuration} 
                        color={profile.color}
                        secondary={profile.secondaryColor}
                        accent={profile.accentColor}
                    />
                    
                    {/* Countdown Overlay */}
                    <div className="countdown-overlay">
                        <span key={secondsLeft} className="big-number">{secondsLeft}</span>
                    </div>
                </div>
                
                <div className="status-text">
                    <h2>{label}</h2>
                </div>
            </div>

            {/* Controls */}
            <div className="controls-area">
                <button 
                    className="play-btn" 
                    onClick={togglePlay}
                    style={{ color: isPlaying ? '#000' : profile.color, background: isPlaying ? '#fff' : '#fff' }}
                >
                    {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
            </div>

            <style>{`
                .session-container {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    z-index: 10;
                    font-family: 'Manrope', sans-serif;
                    background: #000;
                }
                .session-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 2rem;
                    z-index: 20;
                }
                .icon-btn {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: white;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .icon-btn:active {
                    transform: scale(0.9);
                }
                .profile-tag {
                    font-size: 1.1rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    color: #fff;
                    opacity: 0.9;
                }

                .visual-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .visual-stack {
                    position: relative;
                    width: 320px;
                    height: 320px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .countdown-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    pointer-events: none;
                }
                .big-number {
                    font-size: 5rem;
                    font-weight: 800;
                    color: rgba(255,255,255,0.9);
                    text-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                
                .status-text {
                    margin-top: 3rem;
                    text-align: center;
                    height: 60px;
                }
                .status-text h2 {
                    font-size: 2.5rem;
                    font-weight: 800;
                    margin: 0;
                    letter-spacing: 2px;
                    color: #fff;
                    text-transform: uppercase;
                }

                .controls-area {
                    padding: 3rem;
                    display: flex;
                    justify-content: center;
                    padding-bottom: 4rem;
                }
                .play-btn {
                    width: 90px;
                    height: 90px;
                    border-radius: 50%;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    transition: transform 0.2s;
                }
                .play-btn:active {
                    transform: scale(0.92);
                }

                @keyframes popIn {
                    from { transform: scale(0.5); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
