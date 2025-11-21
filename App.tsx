import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Download, ArrowLeft, AlertTriangle, Camera, Monitor, X } from 'lucide-react';
import { AppState, AnalysisResult, RiskItem, RiskLevel, BoundingBox, ImageFilters } from './types';
import { analyzeScreenshot } from './services/geminiService';
import { downloadRedactedImage } from './utils/canvasUtils';
import Header from './components/Header';
import Button from './components/Button';
import AnalysisSidebar from './components/AnalysisSidebar';
import ImageViewer from './components/ImageViewer';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentStep: 'UPLOAD',
    imageUrl: null,
    imageBase64: null,
    analysisResult: null,
    error: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [imageFilters, setImageFilters] = useState<ImageFilters>({
    grayscale: 0,
    sepia: 0,
    brightness: 100,
    contrast: 100,
    blur: 0
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Effects ---

  useEffect(() => {
    // Attach stream to video element when in capture mode
    if (state.currentStep === 'CAPTURE' && videoRef.current && activeStream) {
      videoRef.current.srcObject = activeStream;
    }
  }, [state.currentStep, activeStream]);

  // --- Handlers ---

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setState(prev => ({ ...prev, error: "Please upload a valid image file." }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Store base64 without the prefix for the API, but with prefix for rendering
      const base64Data = result.split(',')[1]; 
      setState({
        currentStep: 'UPLOAD', // Stay on upload until analysis triggers
        imageUrl: result,
        imageBase64: base64Data,
        analysisResult: null,
        error: null,
      });
      // Auto-trigger analysis for better UX
      triggerAnalysis(base64Data);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleStartCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setActiveStream(stream);
      setState(prev => ({ ...prev, currentStep: 'CAPTURE', error: null }));
    } catch (err: any) {
      console.error("Camera Error:", err);
      setState(prev => ({ ...prev, error: "Could not access camera. Please check permissions." }));
    }
  };

  const handleStartScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setActiveStream(stream);
      setState(prev => ({ ...prev, currentStep: 'CAPTURE', error: null }));
      
      // Handle user stopping the share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        handleStopCapture();
      };
    } catch (err: any) {
      console.error("Screen Share Error:", err);
      // User likely cancelled
    }
  };

  const handleStopCapture = useCallback(() => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
    }
    setState(prev => ({ ...prev, currentStep: 'UPLOAD' }));
  }, [activeStream]);

  const handleCaptureImage = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const result = canvas.toDataURL('image/png');
      const base64Data = result.split(',')[1];
      
      // Cleanup stream
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
        setActiveStream(null);
      }

      setState(prev => ({
        ...prev,
        imageUrl: result,
        imageBase64: base64Data,
        analysisResult: null,
        error: null,
      }));
      
      triggerAnalysis(base64Data);
    }
  };

  const triggerAnalysis = async (base64: string) => {
    setState(prev => ({ ...prev, currentStep: 'ANALYZING', error: null }));
    try {
      const result = await analyzeScreenshot(base64);
      setState(prev => ({
        ...prev,
        currentStep: 'REVIEW',
        analysisResult: result,
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        currentStep: 'UPLOAD',
        error: err.message || "Analysis failed",
      }));
    }
  };

  const handleToggleRedaction = (id: string) => {
    if (!state.analysisResult) return;
    
    const updatedRisks = state.analysisResult.risks.map(risk => 
      risk.id === id ? { ...risk, isRedacted: !risk.isRedacted } : risk
    );

    setState(prev => ({
      ...prev,
      analysisResult: prev.analysisResult ? { ...prev.analysisResult, risks: updatedRisks } : null
    }));
  };

  const handleToggleVisibility = (id: string) => {
    if (!state.analysisResult) return;
    
    const updatedRisks = state.analysisResult.risks.map(risk => 
      risk.id === id ? { ...risk, isHidden: !risk.isHidden } : risk
    );

    setState(prev => ({
      ...prev,
      analysisResult: prev.analysisResult ? { ...prev.analysisResult, risks: updatedRisks } : null
    }));
  };

  const handleAddRisk = (box: BoundingBox) => {
    const newRisk: RiskItem = {
      id: `custom-${Date.now()}`,
      type: 'Custom Risk',
      description: 'Manual redaction',
      riskLevel: RiskLevel.HIGH,
      box_2d: box,
      isHidden: false,
      isRedacted: true,
    };

    setState(prev => ({
      ...prev,
      analysisResult: prev.analysisResult ? {
        ...prev.analysisResult,
        risks: [...prev.analysisResult.risks, newRisk]
      } : null
    }));
  };

  const handleUpdateRisk = (id: string, box: BoundingBox) => {
    setState(prev => {
      if (!prev.analysisResult) return prev;
      return {
        ...prev,
        analysisResult: {
          ...prev.analysisResult,
          risks: prev.analysisResult.risks.map(r => r.id === id ? { ...r, box_2d: box } : r)
        }
      };
    });
  };

  const handleUpdateRiskText = (id: string, text: string) => {
    setState(prev => {
      if (!prev.analysisResult) return prev;
      return {
        ...prev,
        analysisResult: {
          ...prev.analysisResult,
          risks: prev.analysisResult.risks.map(r => r.id === id ? { ...r, customText: text } : r)
        }
      };
    });
  };

  const handleUpdateRiskDetails = (id: string, type: string, description: string) => {
    setState(prev => {
      if (!prev.analysisResult) return prev;
      return {
        ...prev,
        analysisResult: {
          ...prev.analysisResult,
          risks: prev.analysisResult.risks.map(r => r.id === id ? { ...r, type, description } : r)
        }
      };
    });
  };

  const handleDeleteRisk = (id: string) => {
    setState(prev => {
      if (!prev.analysisResult) return prev;
      return {
        ...prev,
        analysisResult: {
          ...prev.analysisResult,
          risks: prev.analysisResult.risks.filter(r => r.id !== id)
        }
      };
    });
  };

  const handleDownload = () => {
    if (!state.imageUrl || !state.analysisResult) return;
    setIsProcessing(true);
    downloadRedactedImage(state.imageUrl, state.analysisResult.risks, imageFilters, () => {
      setIsProcessing(false);
    });
  };

  const handleReset = () => {
    // Ensure any lingering streams are stopped
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
    }
    setState({
      currentStep: 'UPLOAD',
      imageUrl: null,
      imageBase64: null,
      analysisResult: null,
      error: null,
    });
    setImageFilters({
      grayscale: 0,
      sepia: 0,
      brightness: 100,
      contrast: 100,
      blur: 0
    });
  };

  // --- Render Steps ---

  const renderUpload = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in overflow-y-auto">
      <div className="max-w-xl w-full bg-gray-800/50 border-2 border-dashed border-gray-600 rounded-2xl p-10 text-center transition-colors hover:border-blue-500 hover:bg-gray-800/80 group">
        <div className="bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
          <ImageIcon className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Drop your screenshot here</h2>
        <p className="text-gray-400 mb-8">
          We'll analyze it for sensitive data like emails, keys, and names.
        </p>
        
        <div className="relative inline-block w-full sm:w-auto mb-8">
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={handleFileUpload}
          />
          <Button variant="primary" className="w-full sm:w-auto relative z-0">
            <Upload className="w-4 h-4" />
            Select Image
          </Button>
        </div>
        
        <div className="flex items-center gap-4 w-full">
          <div className="h-px bg-gray-700 flex-1"></div>
          <span className="text-gray-500 text-xs font-medium uppercase">Or capture</span>
          <div className="h-px bg-gray-700 flex-1"></div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <Button variant="secondary" onClick={handleStartCamera} className="justify-center">
            <Camera className="w-4 h-4" />
            Camera
          </Button>
          <Button variant="secondary" onClick={handleStartScreen} className="justify-center">
            <Monitor className="w-4 h-4" />
            Screen
          </Button>
        </div>

        <p className="mt-6 text-xs text-gray-500">Supported formats: PNG, JPG, WebP</p>
      </div>

      {state.error && (
        <div className="mt-6 flex items-center gap-2 text-red-400 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900/50 max-w-xl w-full">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );

  const renderCapture = () => (
    <div className="flex flex-col items-center justify-center h-full bg-black p-4 relative">
      <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-800">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-contain"
        />
        
        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6">
          <Button variant="secondary" onClick={handleStopCapture} className="bg-white/10 hover:bg-white/20 border-white/10 text-white backdrop-blur-md">
            <X className="w-4 h-4" /> Cancel
          </Button>
          <button 
            onClick={handleCaptureImage}
            className="h-16 w-16 rounded-full bg-white border-4 border-gray-300 flex items-center justify-center hover:scale-105 active:scale-95 transition-all focus:outline-none ring-2 ring-offset-2 ring-offset-black ring-white"
            title="Take Snapshot"
          >
             <div className="w-12 h-12 rounded-full bg-red-500"></div>
          </button>
          <div className="w-[90px]"></div> {/* Spacer for centering */}
        </div>
      </div>
      <p className="mt-4 text-gray-500 text-sm">Align your content and click the capture button</p>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          {state.imageUrl && (
            <img 
              src={state.imageUrl} 
              className="w-16 h-16 rounded-full object-cover opacity-50" 
              alt="thumbnail" 
            />
          )}
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Analyzing Screenshot...</h2>
      <p className="text-gray-400 max-w-md">
        Our AI is scanning for text, UI elements, and metadata that might compromise your privacy.
      </p>
    </div>
  );

  const renderReview = () => {
    if (!state.analysisResult || !state.imageUrl) return null;

    return (
      <div className="flex flex-col lg:flex-row h-full overflow-hidden animate-fade-in">
        <div className="flex-1 relative bg-[#0f1117] h-[50vh] lg:h-auto order-2 lg:order-1">
           <div className="absolute top-4 left-4 z-10 pl-12"> {/* Offset for filters button */}
              <Button variant="secondary" onClick={handleReset} className="shadow-lg bg-gray-900/80 backdrop-blur">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
           </div>
           
           <div className="absolute top-4 right-4 z-10">
              <Button variant="primary" onClick={handleDownload} isLoading={isProcessing} className="shadow-lg">
                <Download className="w-4 h-4" />
                Download Safe Image
              </Button>
           </div>

           <ImageViewer 
             imageUrl={state.imageUrl} 
             risks={state.analysisResult.risks}
             filters={imageFilters}
             onToggleRedaction={handleToggleRedaction}
             onAddRisk={handleAddRisk}
             onUpdateRisk={handleUpdateRisk}
             onUpdateRiskText={handleUpdateRiskText}
             onUpdateRiskDetails={handleUpdateRiskDetails}
             onDeleteRisk={handleDeleteRisk}
             onUpdateFilters={setImageFilters}
           />
        </div>

        <div className="order-1 lg:order-2 border-b lg:border-b-0 lg:border-l border-gray-700 h-[50vh] lg:h-auto flex-shrink-0">
          <AnalysisSidebar 
            summary={state.analysisResult.summary} 
            risks={state.analysisResult.risks}
            onToggleRedaction={handleToggleRedaction}
            onToggleVisibility={handleToggleVisibility}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#111827]">
      {state.currentStep !== 'CAPTURE' && <Header />}
      <main className="flex-1 overflow-hidden relative">
        {state.currentStep === 'UPLOAD' && renderUpload()}
        {state.currentStep === 'CAPTURE' && renderCapture()}
        {state.currentStep === 'ANALYZING' && renderAnalyzing()}
        {state.currentStep === 'REVIEW' && renderReview()}
      </main>
    </div>
  );
};

export default App;