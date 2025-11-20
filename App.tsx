import React, { useState, useCallback } from 'react';
import { Upload, Image as ImageIcon, Download, ArrowLeft, AlertTriangle } from 'lucide-react';
import { AppState, AnalysisResult, RiskItem } from './types';
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
        currentStep: 'UPLOAD', // Stay on upload until analysis triggers or we move manually
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
        currentStep: 'UPLOAD', // Go back to upload to try again
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

  const handleDownload = () => {
    if (!state.imageUrl || !state.analysisResult) return;
    setIsProcessing(true);
    downloadRedactedImage(state.imageUrl, state.analysisResult.risks, () => {
      setIsProcessing(false);
    });
  };

  const handleReset = () => {
    setState({
      currentStep: 'UPLOAD',
      imageUrl: null,
      imageBase64: null,
      analysisResult: null,
      error: null,
    });
  };

  // --- Render Steps ---

  const renderUpload = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in">
      <div className="max-w-xl w-full bg-gray-800 border-2 border-dashed border-gray-600 rounded-2xl p-10 text-center transition-colors hover:border-blue-500 hover:bg-gray-800/50 group">
        <div className="bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
          <ImageIcon className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Drop your screenshot here</h2>
        <p className="text-gray-400 mb-8">
          We'll analyze it for sensitive data like emails, keys, and names.
        </p>
        
        <div className="relative">
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileUpload}
          />
          <Button variant="primary" className="w-full sm:w-auto">
            <Upload className="w-4 h-4" />
            Select Image
          </Button>
        </div>
        <p className="mt-4 text-xs text-gray-500">Supported formats: PNG, JPG, WebP</p>
      </div>

      {state.error && (
        <div className="mt-6 flex items-center gap-2 text-red-400 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900/50">
          <AlertTriangle className="w-4 h-4" />
          <span>{state.error}</span>
        </div>
      )}
    </div>
  );

  const renderAnalyzing = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <img 
            src={state.imageUrl || ''} 
            className="w-16 h-16 rounded-full object-cover opacity-50" 
            alt="thumbnail" 
          />
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
      <div className="flex flex-col lg:flex-row h-full overflow-hidden">
        <div className="flex-1 relative bg-[#0f1117] h-[50vh] lg:h-auto order-2 lg:order-1">
           <div className="absolute top-4 left-4 z-10">
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
             onToggleRedaction={handleToggleRedaction}
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
      <Header />
      <main className="flex-1 overflow-hidden relative">
        {state.currentStep === 'UPLOAD' && renderUpload()}
        {state.currentStep === 'ANALYZING' && renderAnalyzing()}
        {state.currentStep === 'REVIEW' && renderReview()}
      </main>
    </div>
  );
};

export default App;