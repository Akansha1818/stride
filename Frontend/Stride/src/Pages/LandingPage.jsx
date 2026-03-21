import React from 'react'
import Lenis from 'lenis'
import GlassSurface from '../components/GlassSurface'
import SportsInfo from './SportsInfo';
import { ArrowRight,Copyright } from 'lucide-react'
import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import IosLoader from '../components/IosLoader'
import logo from '../assets/logo_with_name.png'
import image1 from '../assets/Image_1.png'
import image2 from '../assets/image_2.png'
import image3 from '../assets/image_3.png'
import image4 from '../assets/image_4.png'
import rectangle from '../assets/Rectangle 3.png'
import icon from '../assets/icon.png'

const LandingPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(false)
  const Navigate= useNavigate()

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      smoothTouch: true,
      touchMultiplier: 1.5,
    });

    let animationFrameId;

    const raf = (time) => {
      lenis.raf(time);
      animationFrameId = window.requestAnimationFrame(raf);
    };

    animationFrameId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      lenis.stop();
      lenis.destroy();
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
      document.body.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
      document.documentElement.style.removeProperty('scroll-behavior');
      document.body.style.removeProperty('scroll-behavior');
    };
  }, []);
  const handleGetStarted = () => {
    setLoading(true)

    setTimeout(() => {
      Navigate('/signup')
    }, 1000) 
    // delay for smooth feel
  }

  return (
    <div className='min-h-screen w-full overflow-x-hidden'>
      {loading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-[2px] flex items-center justify-center z-50">
          <IosLoader />
        </div>
      )}
      <div className='w-full'>
        
        <div className='w-full flex items-center justify-center'>
          <img className='mt-8 w-[127.503px] h-[39.264px]' src={logo} alt='logo'/>
        </div>

        <p className='text-[#646464] px-15 max-w-xl mx-auto text-center mt-20 text-[12px] md:text-[16px] md:px-23'>
          Most people train without clear feedback. they repeat the same mistakes without knowing it.
        </p>

        <p className='text-black px-5 mt-8 max-w-2xl mx-auto text-center text-[20px] md:text-[34px] leading-snug'>
          Stride analyzes your training videos and tells you what you're doing wrong and how to fix it.
        </p>
        <div className='flex justify-center items-center mt-10'>
          <div
            onClick={handleGetStarted}
            className={`
              flex items-center justify-center gap-1 cursor-pointer
              bg-[url('/src/assets/btn-bg.png')] bg-cover mr-8 md:mr-15
              ${isMobile ? 'w-[146px] h-[35px]' : 'w-[300px] h-[60px]'}
            `}
          >
            <h2 className={isMobile ? 'text-[10px] ml-8' : 'text-[18px] text-[#191919] ml-15 mt-2'}>
              Get Started
            </h2>
            <ArrowRight
              className={isMobile ? 'w-3 h-3 mb-0.48' : 'w-5 h-5 mt-2'}
              strokeWidth={1.8}
            />
          </div>
        </div>

      </div>
      <section className="relative w-full mt-24 flex justify-center px-4">

  {/* ================= MOBILE VERSION ================= */}
  <div className="w-full max-w-[360px] md:hidden justify-center items-center relative">
    <img
      src={image1}
      className="absolute w-[121.79px] h-[69.59px] left-[-115px] top-[60px] rotate-[9.46deg] rounded-[16px] bg-transparent"
    />
    <img
      src={image2}
      className="absolute w-[121.79px] h-[69.59px] right-[-35px] top-[40px] rotate-[12.6deg] rounded-[16px] bg-transparent"
    />
    <img
      src={image3}
      className="absolute w-[121.79px] h-[69.59px] left-[-20px] bottom-[18px]  rotate-[-9deg] rounded-[16px] bg-transparent"
    />

    <div className="relative z-10
      bg-white
      rounded-[16px] w-[305.02px] h-[300px]
      px-6 py-6
      shadow-[0_10px_40px_rgba(0,0,0,0.08)] ml-4
    ">
      <div className="text-black tracking-[-0.113px] leading-relaxed space-y-3 text-[6.598px] font-medium">

        <p>
          We’re building a world where anyone can understand and improve their movement.
          Where progress isn’t based on guesswork, but on clear feedback.
        </p>

        <p>
          Stride analyzes how your body moves, detects inefficiencies, and shows you exactly what to change.
          Over time, it learns your patterns and improvement.
        </p>

        <p>
          What once required a trained coach and manual analysis, can now happen instantly, from a single video.
        </p>

        <p>
          Our goal is to make high-quality feedback accessible to anyone who wants to improve.
          So progress becomes consistent, measurable, and inevitable.
        </p>
        <p>
          This is just the starting point.
        </p>
        <p>
          We’re building toward real-time feedback, continuous tracking, and agents that help guide your training as you move
        </p>
        <p>
          So improvement doesn’t rely on guesswork or external coaches. It becomes something you can access instantly, anytime.
        </p>
        <p>
          Our goal is simple. make high-quality feedback available to anyone who wants to improve.
        </p>
        
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <img className='w-[22px] h-[8px]' src={logo} alt='logo'></img>
        </div>

      </div>
    </div>
  </div>



  {/* ================= DESKTOP VERSION ================= */}
  <div className="hidden md:flex w-full justify-center items-center relative mb-50">

    {/* floating images */}
    <img
      src={image1}
      className="absolute w-[350px] h-[200px] left-[-100px] top-[115px]  rotate-[9.46deg] rounded-[16px] bg-transparent"
    />

    <img
      src={image2}
      className="absolute w-[350px] h-[200px] right-[125px] top-[65px]  rotate-[12.6deg] rounded-[16px] bg-transparent"
    />

    <img
      src={image3}
      className="absolute w-[350px] h-[200px] left-[220px] bottom-[-82px]  rotate-[-7.14deg] rounded-[16px] bg-transparent"
    />

    <img
      src={image4}
      className="absolute w-[350px] h-[200px] right-[-105px] bottom-[-5px] rotate-[-15.38deg] rounded-[16px] bg-transparent"
    />



    {/* center card */}
    <div className="
      relative z-10
      w-full max-w-[715px] h-[639px]
      bg-white
      rounded-[18px]
      px-10 py-12
      shadow-[0_25px_80px_rgba(0,0,0,0.12)]
    ">

      <div className="text-[16px] font-medium text-black leading-relaxed space-y-4">

        <p>
          We’re building a world where anyone can understand and improve their movement.
          Where progress isn’t based on guesswork, but on clear feedback.
        </p>

        <p>
          Stride analyzes how your body moves, detects inefficiencies, and shows you exactly what to change.
          Over time, it learns your patterns and improvement.
        </p>

        <p>
          What once required a trained coach and manual analysis, can now happen instantly, from a single video.
        </p>

        <p>
          Our goal is to make high-quality feedback accessible to anyone who wants to improve.
          So progress becomes consistent, measurable, and inevitable.
        </p>

        <p>This is just the starting point.</p>

        <p>
          We’re building toward real-time feedback, continuous tracking, and agents that help guide your training.
        </p>

        <p>
          So improvement doesn’t rely on guesswork or external coaches.
        </p>

        <p>
          Our goal is simple: make high-quality feedback available to anyone who wants to improve.
        </p>

        <div className="pt-4 flex items-center gap-2 text-sm text-gray-600">
          <img className='w-[82px] h-[26.46px]' src={logo}></img>
          
        </div>

      </div>

    </div>
  </div>

</section>

<section className='flex flex-col justify-start mx-2 mt-15 md:mx-20 '>
  <h1 className='text-black text-[35.74px] hidden md:block'>See how Stride works,</h1>
  <div className='flex justify-around md:justify-between'>
    <div className='w-[40%] md:w-[60%] flex flex-col gap-3 md:gap-20 md:mt-10'>
      <SportsInfo number="1" heading="Record your training" description="Use your phone to record your exercise, movement, or practice from any angle." />
      <SportsInfo number="2" heading="Upload your video to Stride" description="Stride analyzes your movement frame by frame to detect inefficiencies and form breakdowns." />
      <SportsInfo number="3" heading="Get precise feedback" description="See exactly what you're doing wrong and what to change to improve your performance." />
    </div>
    <div>
      <img className='md:w-[423px] md:h-[704px] w-[121px] h-[202px]' src={rectangle}></img>
    </div>
    
  </div>
</section>

<section className='w-full flex flex-col justify-center items-center mt-20 md:mt-30 md:gap-1'>
    <img className='md:w-[100px] md:h-[100px] w-[55px] h-[55px] mb-8' src={icon} alt='icon'></img>
    <h1 className='md:text-[46.3px] text-[25px] mb-3'>Improve how you move</h1>
    <p className='md:text-[19px] text-[10.4px] text-[#000000B0]'>Join Stride to get precise feedback on your training.</p>
    <p className='md:text-[19px] text-[10.4px] text-[#000000B0] mb-7'>Upload your videos, Improve faster.</p>
    <div
            onClick={handleGetStarted}
            className={`
              flex items-center justify-center gap-1 cursor-pointer
              bg-[url('/src/assets/btn-bg.png')] bg-cover mr-8 md:mr-15
              ${isMobile ? 'w-[146px] h-[35px]' : 'w-[300px] h-[60px]'}
            `}
          >
            <h2 className={isMobile ? 'text-[10px] ml-8' : 'text-[18px] text-[#191919] ml-15 mt-2'}>
              Get Started
            </h2>
            <ArrowRight
              className={isMobile ? 'w-3 h-3 mb-0.48' : 'w-5 h-5 mt-2'}
              strokeWidth={1.8}
            />
          </div>
          <div className='md:text-[18px] flex items-center justify-center text-[#000000BF] text-[9.861px] gap-1 mt-15 font-normal mb-10 md:mb-15'>
            <Copyright size={isMobile ? 12 : 20} strokeWidth={1.25} />
            <p>Stride 2026</p>
          </div>
    
</section>
  
  
    </div>
  )
}

export default LandingPage
