import { useState, useRef, useEffect } from 'react';

import MainPage from '../../components/Dashboard/mainPage';
import Mainheader from '../../components/Dashboard/header';
import MainSidebar from '../../components/Dashboard/sidebar';



const FinanceDashboard = () => {
    // Initialize from localStorage, default to 'dashboard' if nothing is saved
    const [activeSection, setActiveSection] = useState<string>(() => {
        return localStorage.getItem('activeSection') || 'dashboard';
    });
    const [sidebarOpen, setSidebarOpen] = useState(true); // start closed on mobile
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const mainContentRef = useRef<HTMLDivElement>(null);
    const [scrolled, setScrolled] = useState(false);
    console.log("activeSection", scrolled);
    // Save to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('activeSection', activeSection);
    }, [activeSection]);
    // Handle scroll effect for logo
    useEffect(() => {
        const handleScroll = () => {
            if (mainContentRef.current) {
                setScrolled(mainContentRef.current.scrollTop > 50);
            }
        };

        const mainContent = mainContentRef.current;
        if (mainContent) {
            mainContent.addEventListener('scroll', handleScroll);
            return () => mainContent.removeEventListener('scroll', handleScroll);
        }
    }, []);

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* Sidebar for desktop */}

            <MainSidebar
                sidebarOpen={sidebarOpen}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
                setSidebarOpen={setSidebarOpen}
            />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed hidden inset-0 z-40 bg-black bg-opacity-50 lg:hidden transition-opacity duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main content area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top navbar */}
                <Mainheader
                    setActiveSection={setActiveSection}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    setUserDropdownOpen={setUserDropdownOpen}
                    userDropdownOpen={userDropdownOpen}
                //   scrolled={scrolled}
                />

                {/* Main content scrollable */}
                <div
                    ref={mainContentRef}
                    className="flex-1 overflow-auto p-0 md:p-6 transition-all duration-300"
                >
                    <MainPage activeSection={activeSection} mainContentRef={mainContentRef} />
                </div>
            </div>
        </div>
    );
};

export default FinanceDashboard;
