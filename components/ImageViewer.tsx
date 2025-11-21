import React, { useRef, useState, useEffect } from 'react';
import { RiskItem, BoundingBox, ImageFilters } from '../types';
import { Eye, EyeOff, Trash2, Move, Type, Sliders, X, RotateCcw } from 'lucide-react';

interface Props {
  imageUrl: string;
  risks: RiskItem[];
  filters: ImageFilters;
  onToggleRedaction: (id: string) => void;
  onAddRisk: (box: BoundingBox) => void;
  onUpdateRisk: (id: string, box: BoundingBox) => void;
  onUpdateRiskText: (id: string, text: string) => void;
  onUpdateRiskDetails: (id: string, type: string, description: string) => void;
  onDeleteRisk: (id: string) => void;
  onUpdateFilters: (filters: ImageFilters) => void;
}

type InteractionState = 
  | { type: 'IDLE' }
  | { type: 'DRAWING'; startX: number; startY: number; currentX: number; currentY: number }
  | { type: 'MOVING'; id: string; startX: number; startY: number; initialBox: BoundingBox }
  | { type: 'RESIZING'; id: string; handle: string; startX: number; startY: number; initialBox: BoundingBox };

const ImageViewer: React.FC<Props> = ({ 
  imageUrl, 
  risks,
  filters,
  onToggleRedaction, 
  onAddRisk, 
  onUpdateRisk,
  onUpdateRiskText,
  onUpdateRiskDetails,
  onDeleteRisk,
  onUpdateFilters
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>({ type: 'IDLE' });
  const [showFilters, setShowFilters] = useState(false);

  // --- Helpers ---

  const getNormalizedPoint = (e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
      x: Math.max(0, Math.min(1000, (x / rect.width) * 1000)),
      y: Math.max(0, Math.min(1000, (y / rect.height) * 1000))
    };
  };

  const getBoxCoordinates = (box: BoundingBox) => {
    // Convert 1000-based coords to percentages
    const top = box.ymin / 10;
    const left = box.xmin / 10;
    const width = (box.xmax - box.xmin) / 10;
    const height = (box.ymax - box.ymin) / 10;
    return { top, left, width, height };
  };

  // --- Event Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getNormalizedPoint(e);

    // Deselect on click outside, handled by background down
    // NOTE: Stop propagation is used on child elements to prevent this trigger.
    setSelectedId(null);
    setInteraction({ type: 'DRAWING', startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleBoxDown = (e: React.PointerEvent, id: string, box: BoundingBox) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    setInteraction({ 
      type: 'MOVING', 
      id, 
      startX: e.clientX, // Use absolute screen coords for deltas
      startY: e.clientY,
      initialBox: { ...box }
    });
  };

  const handleHandleDown = (e: React.PointerEvent, id: string, handle: string, box: BoundingBox) => {
    e.stopPropagation();
    e.preventDefault();
    setInteraction({ 
      type: 'RESIZING', 
      id, 
      handle,
      startX: e.clientX, 
      startY: e.clientY,
      initialBox: { ...box }
    });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (interaction.type === 'IDLE') return;

      if (interaction.type === 'DRAWING') {
        const { x, y } = getNormalizedPoint(e);
        setInteraction(prev => prev.type === 'DRAWING' ? { ...prev, currentX: x, currentY: y } : prev);
      } else if (interaction.type === 'MOVING') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const deltaX = ((e.clientX - interaction.startX) / rect.width) * 1000;
        const deltaY = ((e.clientY - interaction.startY) / rect.height) * 1000;
        
        const newBox = {
          xmin: interaction.initialBox.xmin + deltaX,
          xmax: interaction.initialBox.xmax + deltaX,
          ymin: interaction.initialBox.ymin + deltaY,
          ymax: interaction.initialBox.ymax + deltaY,
        };

        onUpdateRisk(interaction.id, newBox);
      } else if (interaction.type === 'RESIZING') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const deltaX = ((e.clientX - interaction.startX) / rect.width) * 1000;
        const deltaY = ((e.clientY - interaction.startY) / rect.height) * 1000;

        let { xmin, xmax, ymin, ymax } = interaction.initialBox;

        if (interaction.handle.includes('l')) xmin += deltaX;
        if (interaction.handle.includes('r')) xmax += deltaX;
        if (interaction.handle.includes('t')) ymin += deltaY;
        if (interaction.handle.includes('b')) ymax += deltaY;

        // Simple validation to prevent negative dimensions
        if (xmax < xmin + 10) xmax = xmin + 10;
        if (ymax < ymin + 10) ymax = ymin + 10;

        onUpdateRisk(interaction.id, { xmin, xmax, ymin, ymax });
      }
    };

    const handlePointerUp = () => {
      if (interaction.type === 'DRAWING') {
        // Create the box if it has size
        const xmin = Math.min(interaction.startX, interaction.currentX);
        const xmax = Math.max(interaction.startX, interaction.currentX);
        const ymin = Math.min(interaction.startY, interaction.currentY);
        const ymax = Math.max(interaction.startY, interaction.currentY);

        if (xmax - xmin > 10 && ymax - ymin > 10) {
          onAddRisk({ xmin, xmax, ymin, ymax });
        }
      }
      setInteraction({ type: 'IDLE' });
    };

    if (interaction.type !== 'IDLE') {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [interaction, onAddRisk, onUpdateRisk]);

  const resetFilters = () => {
    onUpdateFilters({
      grayscale: 0,
      sepia: 0,
      brightness: 100,
      contrast: 100,
      blur: 0
    });
  };

  // --- Render ---

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#0f1117] overflow-auto p-4 md:p-8 select-none">
      
      {/* Filter Controls Button */}
      <div className="absolute top-4 left-4 z-30">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-lg shadow-lg border transition-all ${showFilters ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-900/80 text-gray-300 border-gray-700 hover:bg-gray-800'}`}
          title="Image Filters"
        >
          <Sliders className="w-5 h-5" />
        </button>

        {/* Filter Panel */}
        {showFilters && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl p-4 flex flex-col gap-4 animate-fade-in z-40">
             <div className="flex items-center justify-between pb-2 border-b border-gray-700">
               <span className="font-semibold text-xs text-gray-400 uppercase tracking-wider">Image Adjustments</span>
               <button onClick={resetFilters} className="text-gray-500 hover:text-white" title="Reset All">
                 <RotateCcw size={12} />
               </button>
             </div>

             {/* Sliders */}
             <div className="space-y-3">
               <div className="space-y-1">
                 <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                   <span>Brightness</span>
                   <span>{filters.brightness}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="200" 
                    value={filters.brightness}
                    onChange={(e) => onUpdateFilters({...filters, brightness: Number(e.target.value)})}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
               </div>

               <div className="space-y-1">
                 <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                   <span>Contrast</span>
                   <span>{filters.contrast}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="200" 
                    value={filters.contrast}
                    onChange={(e) => onUpdateFilters({...filters, contrast: Number(e.target.value)})}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
               </div>

               <div className="space-y-1">
                 <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                   <span>Grayscale</span>
                   <span>{filters.grayscale}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="100" 
                    value={filters.grayscale}
                    onChange={(e) => onUpdateFilters({...filters, grayscale: Number(e.target.value)})}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
               </div>

               <div className="space-y-1">
                 <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                   <span>Sepia</span>
                   <span>{filters.sepia}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="100" 
                    value={filters.sepia}
                    onChange={(e) => onUpdateFilters({...filters, sepia: Number(e.target.value)})}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
               </div>

               <div className="space-y-1">
                 <div className="flex justify-between text-[10px] text-gray-400 uppercase">
                   <span>Blur</span>
                   <span>{filters.blur}px</span>
                 </div>
                 <input 
                    type="range" min="0" max="20" step="0.5"
                    value={filters.blur}
                    onChange={(e) => onUpdateFilters({...filters, blur: Number(e.target.value)})}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
               </div>
             </div>
          </div>
        )}
      </div>

      <div 
        className="relative shadow-2xl rounded-[8px] overflow-hidden border border-gray-700 inline-block max-w-full max-h-full touch-none" 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        style={{ cursor: interaction.type === 'DRAWING' ? 'crosshair' : 'default' }}
      >
        <img 
          src={imageUrl} 
          alt="Analysis Target" 
          className="block max-w-full max-h-[80vh] w-auto h-auto object-contain pointer-events-none"
          draggable={false}
          style={{
            filter: `grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) brightness(${filters.brightness}%) contrast(${filters.contrast}%) blur(${filters.blur}px)`
          }}
        />
        
        {/* Render Temporary Drawing Box */}
        {interaction.type === 'DRAWING' && (
          <div 
            className="absolute border-2 border-blue-500 bg-blue-500/20 z-50"
            style={{
              left: `${Math.min(interaction.startX, interaction.currentX) / 10}%`,
              top: `${Math.min(interaction.startY, interaction.currentY) / 10}%`,
              width: `${Math.abs(interaction.currentX - interaction.startX) / 10}%`,
              height: `${Math.abs(interaction.currentY - interaction.startY) / 10}%`,
            }}
          />
        )}
        
        {/* Render Existing Risks */}
        {risks.map((risk) => {
          if (!risk.box_2d || risk.isHidden) return null;

          const isSelected = selectedId === risk.id;
          const coords = getBoxCoordinates(risk.box_2d);
          const isNearTop = coords.top < 30;
          
          return (
            <div
              key={risk.id}
              onPointerDown={(e) => handleBoxDown(e, risk.id, risk.box_2d!)}
              className={`absolute group
                ${risk.isRedacted 
                  ? 'z-20' 
                  : 'z-10 hover:bg-red-500/10'
                }
              `}
              style={{
                top: `${coords.top}%`,
                left: `${coords.left}%`,
                width: `${coords.width}%`,
                height: `${coords.height}%`,
                cursor: isSelected ? 'move' : 'pointer',
                // Visual styles
                backgroundColor: risk.isRedacted ? '#000' : (isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.15)'),
                
                // Redaction Texture: Diagonal stripes with slight noise/contrast
                backgroundImage: risk.isRedacted 
                  ? 'repeating-linear-gradient(45deg, #000 0, #000 4px, #1f2937 4px, #1f2937 8px)' 
                  : 'none',
                
                // Border for contrast against dark backgrounds
                border: isSelected 
                  ? '2px solid #3b82f6' 
                  : (risk.isRedacted ? '1px solid rgba(255,255,255,0.3)' : '2px solid #ef4444'),
                
                boxShadow: isSelected 
                  ? '0 0 0 2px rgba(59, 130, 246, 0.3)' 
                  : (risk.isRedacted ? '0 4px 6px rgba(0,0,0,0.3)' : 'none')
              }}
            >
              {/* Render Custom Text if Redacted */}
              {risk.isRedacted && risk.customText && (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                  <span className="text-white font-bold text-xs md:text-sm px-1 drop-shadow-md truncate">
                    {risk.customText}
                  </span>
                </div>
              )}

              {/* Labels / Controls (only when selected) */}
              {isSelected && (
                <>
                  {/* Expanded Edit Card */}
                  <div 
                    className="absolute left-0 bg-gray-900 text-white text-xs rounded-lg shadow-xl border border-gray-700 p-3 w-64 z-50 flex flex-col gap-2.5 cursor-default" 
                    style={isNearTop ? { top: '100%', marginTop: '8px' } : { bottom: '100%', marginBottom: '8px' }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    {/* Header Row: Actions */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-700">
                        <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider">Edit Risk</span>
                         <div className="flex items-center gap-1">
                            <button 
                              onClick={() => onToggleRedaction(risk.id)} 
                              className={`p-1.5 rounded transition-colors ${risk.isRedacted ? 'bg-blue-900/30 text-blue-400 border border-blue-900' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                              title={risk.isRedacted ? "Reveal" : "Redact"}
                            >
                                {risk.isRedacted ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button 
                              onClick={() => onDeleteRisk(risk.id)} 
                              className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors"
                              title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                         </div>
                    </div>

                    {/* Type Input */}
                    <div>
                         <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Risk Type</label>
                         <input 
                            type="text" 
                            value={risk.type} 
                            onChange={(e) => onUpdateRiskDetails(risk.id, e.target.value, risk.description)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            placeholder="e.g. Credit Card, Email..."
                         />
                    </div>

                    {/* Description Input */}
                    <div>
                         <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Description</label>
                         <textarea 
                            value={risk.description} 
                            onChange={(e) => onUpdateRiskDetails(risk.id, risk.type, e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none h-14 transition-all"
                            placeholder="Details about this risk..."
                         />
                    </div>

                    {/* Label on Image Input (only if redacted) */}
                    {risk.isRedacted && (
                        <div className="pt-1">
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">Overlay Label</label>
                            <div className="flex items-center bg-gray-800 border border-gray-600 rounded px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                <Type size={12} className="text-gray-400 mr-2 flex-shrink-0"/>
                                <input 
                                    type="text" 
                                    value={risk.customText || ''} 
                                    onChange={(e) => onUpdateRiskText(risk.id, e.target.value)}
                                    placeholder="REDACTED"
                                    className="w-full bg-transparent border-none text-xs text-white focus:ring-0 p-0 outline-none placeholder-gray-600"
                                />
                            </div>
                        </div>
                    )}
                  </div>

                  {/* Resize Handles */}
                  {['tl', 'tr', 'bl', 'br'].map(handle => {
                    const isTop = handle.includes('t');
                    const isLeft = handle.includes('l');
                    const cursor = (isTop === isLeft) ? 'nwse-resize' : 'nesw-resize';

                    return (
                      <div
                        key={handle}
                        onPointerDown={(e) => handleHandleDown(e, risk.id, handle, risk.box_2d!)}
                        className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-50 shadow-md hover:scale-125 hover:bg-blue-50 transition-transform flex items-center justify-center"
                        style={{
                          top: isTop ? '-5px' : 'auto',
                          bottom: !isTop ? '-5px' : 'auto',
                          left: isLeft ? '-5px' : 'auto',
                          right: !isLeft ? '-5px' : 'auto',
                          cursor: cursor
                        }}
                        title="Resize"
                      />
                    );
                  })}
                </>
              )}

              {/* If not redacted and not selected, show simple tooltip on hover */}
              {!isSelected && !risk.isRedacted && coords.width > 5 && coords.height > 5 && (
                <div className="hidden group-hover:flex absolute inset-0 items-center justify-center pointer-events-none">
                  <span className="bg-red-600/90 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm">
                    Click to Edit
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur text-gray-300 px-5 py-2.5 rounded-full text-sm border border-gray-700 shadow-lg pointer-events-none z-30 flex items-center gap-4">
        <div className="flex items-center gap-2">
           <Move className="w-4 h-4 text-blue-400" />
           <span>Drag to create</span>
        </div>
        <div className="w-px h-4 bg-gray-700"></div>
        <div>Click box to edit</div>
      </div>
    </div>
  );
};

export default ImageViewer;