import React, { useContext } from 'react';
import { UserContext } from "../../context/UserContext";
import Navbar from './Navbar';
import SideMenu from './SideMenu';

const DashboardLayout = ({ children, activeMenu }) => {
    const { user } = useContext(UserContext);

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar activeMenu={activeMenu} />

            <div className="flex min-h-[calc(100vh-61px)]">
                {/* SideMenu is always rendered */}
                <div className="hidden lg:block">
                    <SideMenu activeMenu={activeMenu} />
                </div>

                <div className="flex-1 px-4 lg:px-6 py-4 lg:py-6 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardLayout;