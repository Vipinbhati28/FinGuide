import React, { useState } from 'react';
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";
import SideMenu from './SideMenu';

const Navbar = ({ activeMenu }) => {
  const [openSideMenu, setOpenSideMenu] = useState(false);

  return (
    <div className="flex items-center justify-between bg-white border-b border-gray-200/50 backdrop-blur-[2px] py-3 px-4 lg:py-4 lg:px-7 sticky top-0 z-30">
      <button 
        className="block lg:hidden text-black hover:text-gray-600 transition-colors"
        onClick={() => setOpenSideMenu(!openSideMenu)}
      >
        {openSideMenu ? (
          <HiOutlineX className="text-2xl" />
        ) : (
          <HiOutlineMenu className="text-2xl" />
        )}
      </button>

      <h2 className="text-lg lg:text-xl font-medium text-black">FinGuide</h2>

      {/* Mobile SideMenu */}
      {openSideMenu && (
        <div className="fixed top-[61px] left-0 w-64 h-screen bg-white shadow-lg z-40 lg:hidden">
          <SideMenu activeMenu={activeMenu} />
        </div>
      )}
    </div>
  );
};

export default Navbar;
