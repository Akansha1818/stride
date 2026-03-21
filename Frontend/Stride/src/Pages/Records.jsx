import React, { useState, useEffect } from 'react'
import { formatDistanceStrict } from 'date-fns'
import api from "../lib/axios"
import IosLoader from '../components/IosLoader'
import { useNavigate } from 'react-router-dom'

const Records = () => {
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [now, setNow] = useState(new Date())
    const navigate = useNavigate()

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date())
        }, 10000)

        return () => clearInterval(interval)
    }, [])

    const getRecords = async () => {
        try {
            setLoading(true)
            const response = await api.get('/analysis/all')
            setRecords(response.data.analyses || [])
        } catch (e) {
            setError(e?.customMessage || 'Failed to fetch records')
        } finally {
            setLoading(false)
        }
    }
    

    useEffect(() => {
        getRecords()
    }, [])

    if (loading) return (
        <div className="flex justify-center items-center py-10">
            <IosLoader />
        </div>
    )

    return (
        <div className='flex flex-col'>
            {error ? (
                <p className='text-[12px] text-red-500 font-[460] mb-2'>{error}</p>
            ) : null}

            {records.length === 0 ? (
                <div className='bg-white w-90 h-18 rounded-2xl flex justify-between items-center px-5 py-2 mb-3'>
                    <div className='gap-3'>
                        <p className='text-black text-sm font-medium mb-1'>Nothing to See here...</p>
                        <p className='text-[#9B9CA1] text-xs'>Upload something</p>
                    </div>
                </div>
            ) : (
                records.map((record) => {
                    const created = new Date(record.createdAt)

                    const formattedDate = created.toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                    })

                    const timeAgo = formatDistanceStrict(created, now, {
                        addSuffix: true,
                    })


                    return (
                        <div
                            key={record._id}
                            className='bg-white w-90 h-18 rounded-2xl flex justify-between items-center px-5 py-2 mb-3 cursor-pointer'
                            onClick={() => navigate(`/feedback/${record._id}`)}
                        >
                            <div className='gap-3'>
                                <p className='text-black text-sm font-medium mb-[1.4px]'>
                                    {formattedDate} – {record.filename}
                                </p>
                                <p className='text-[#9B9CA1] text-xs'>{timeAgo}</p>
                            </div>
                            <img className='w-3 h-3 mr-2' src='https://ik.imagekit.io/g2fqofeyv/_.png' alt='arrow' />
                        </div>
                    )
                })
            )}
        </div>
    )
}

export default Records