import React, { useRef, useState, useEffect } from 'react';
import { RiskItem } from '../types';

interface Props {
  imageUrl: string;
  risks: RiskItem[];
  onToggleRedaction: (id: string) => void;
}

const ImageViewer: React.FC<Props> = ({ imageUrl, risks, onToggleRedaction }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredRiskId, setHoveredRiskId] = useState<string | null>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setDimensions({ width, height });
  };

  // Re-measure on window resize
  useEffect(() => {
    const handleResize = () => {
       if (containerRef.current) {
          // This simple logic just forces a re-render if needed, 
          // but actual overlay positions are calculated via CSS percentages relative to parent.
          // No complex JS math needed for responsiveness if we use %!
       }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#0f1117] overflow-auto p-4 md:p-8">
      <div className="relative shadow-2xl rounded-lg overflow-hidden border border-gray-700 inline-block max-w-full max-h-full" ref={containerRef}>
        <img 
          src={imageUrl} 
          alt="Analysis Target" 
          className="block max-w-full max-h-[80vh] w-auto h-auto object-contain"
          onLoad={handleImageLoad}
        />
        
        {/* Overlays */}
        {risks.map((risk) => {
          if (!risk.box_2d || risk.isHidden) return null;

          const { ymin, xmin, ymax, xmax } = risk.box_2d;
          
          // Convert 1000-based coords to percentages
          const top = ymin / 10;
          const left = xmin / 10;
          const width = (xmax - xmin) / 10;
          const height = (ymax - ymin) / 10;

          const isHovered = hoveredRiskId === risk.id;
          
          return (
            <div
              key={risk.id}
              onClick={() => onToggleRedaction(risk.id)}
              onMouseEnter={() => setHoveredRiskId(risk.id)}
              onMouseLeave={() => setHoveredRiskId(null)}
              className={`absolute cursor-pointer transition-all duration-200 border-2 flex items-center justify-center group
                ${risk.isRedacted 
                  ? 'bg-black border-black z-20' 
                  : 'bg-red-500/20 border-red-500 z-10 hover:bg-red-500/30'
                }
                ${isHovered && !risk.isRedacted ? 'scale-[1.02] shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''}
              `}
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
              title={`${risk.type} - Click to ${risk.isRedacted ? 'reveal' : 'redact'}`}
            >
              {/* Icon displayed in the center of the box if it's large enough and NOT redacted */}
              {!risk.isRedacted && width > 5 && height > 5 && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white text-[10px] px-1 rounded shadow-sm pointer-events-none">
                  Redact
                </div>
              )}
              
              {/* If redacted, showing a subtle pattern or label if large */}
              {risk.isRedacted && width > 10 && height > 5 && (
                 <span className="text-gray-800 font-mono text-xs opacity-50 select-none">REDACTED</span>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/80 backdrop-blur text-gray-300 px-4 py-2 rounded-full text-sm border border-gray-700 shadow-lg pointer-events-none">
        Click on highlighted areas to toggle redaction
      </div>
    </div>
  );
};

export default ImageViewer;